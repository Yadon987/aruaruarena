# frozen_string_literal: true

require 'concurrent'

# JudgePostService - 投稿のAI審査を実行するサービス
#
# 3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）による
# 並列審査を実行し、その結果をDynamoDBに保存します。
class JudgePostService
  include JudgeCommonConcern

  # 審査員の設定
  JUDGES = [
    { persona: 'hiroyuki', adapter: GeminiAdapter },
    { persona: 'dewi',     adapter: :dewi_adapter_class },
    { persona: 'nakao',    adapter: OpenAiAdapter }
  ].freeze

  # タイムアウト設定（Lambda環境を考慮）
  PER_JUDGE_TIMEOUT = 70  # 各審査員のタイムアウト（秒）
  JOIN_TIMEOUT = 90       # 全体のタイムアウト（秒）
  MAX_ERROR_BACKTRACE_LINES = 20
  # 審査員数と同じスレッド数に揃え、キューを有限にして:caller_runsの背圧を効かせる
  EXECUTOR_THREAD_COUNT = JUDGES.size
  EXECUTOR_MAX_QUEUE = JUDGES.size
  EXECUTOR_SHUTDOWN_WAIT_SECONDS = 5
  CLAIM_STALE_SECONDS = 300

  # 初期化
  #
  # @param post_id [String] 投稿ID
  def initialize(post_id)
    @post = Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[JudgePostService] Post not found: #{post_id}")
    @post = nil
  end

  # 投稿の審査を実行
  #
  # @return [void]
  def execute
    return if @post.nil?

    claim_result = claim_post_for_judging!
    return skip_by_claim_result(claim_result) unless claim_result == :claimed

    # スレッドセーフにクラスを事前にロード/解決しておく
    resolved_judges = JUDGES.map do |judge|
      {
        persona: judge[:persona],
        adapter_class: resolve_adapter_class(judge[:adapter])
      }
    end

    # Concurrent::Futureを使用して並列審査を実行
    futures = resolved_judges.map do |judge_config|
      Concurrent::Future.execute(executor: executor) do
        # RailsのExecutorでラップして、オートロードやDB接続をスレッドセーフにする
        Rails.application.executor.wrap do
          process_single_judge(judge_config[:persona], judge_config[:adapter_class])
        end
      rescue StandardError => e
        handle_thread_error(judge_config[:persona], e)
      end
    end

    # タイムアウト付きでFutureを待機
    results = futures.each_with_index.map do |future, idx|
      persona = resolved_judges[idx][:persona]
      result = future.value(PER_JUDGE_TIMEOUT)

      if result.nil?
        handle_timeout(persona)
      else
        result
      end
    rescue StandardError => e
      handle_thread_error(persona, e)
    end

    save_judgments!(results)
    update_post_status!(@post, @successful_judgments)
  ensure
    shutdown_executor
  end

  class << self
    # 投稿の審査を実行
    #
    # @param post_id [String] 投稿ID
    # @return [void]
    def call(post_id)
      new(post_id).execute
    end
  end

  private

  # 個別の審査員処理
  def process_single_judge(persona, adapter_class)
    Rails.logger.info("[JudgePostService] 審査開始: persona=#{persona}")

    adapter = adapter_class.new
    result = adapter.judge(@post.body, persona: persona)

    if result.succeeded
      Rails.logger.info("[JudgePostService] 審査成功: persona=#{persona}")
    else
      Rails.logger.warn(
        "[JudgePostService] 審査失敗: persona=#{persona}, " \
        "error_code=#{result.error_code}, adapter=#{adapter_class.name}"
      )
    end

    { persona: persona, result: result }
  rescue StandardError => e
    Rails.logger.error(
      "[JudgePostService] 例外発生: persona=#{persona}, " \
      "adapter=#{adapter_class.name}, error_class=#{e.class}, message=#{e.message}"
    )
    handle_thread_error(persona, e)
  end

  # スレッド内エラーハンドリング
  def handle_thread_error(persona, error)
    # スタックトレースを含めてログ出力（デバッグ用）
    Rails.logger.error("[JudgePostService] Exception in thread for #{persona}: #{error.message}")
    Rails.logger.error(Array(error.backtrace).first(MAX_ERROR_BACKTRACE_LINES).join("\n"))

    judge_error = JudgeError.new(
      judge_persona: persona,
      error_code: 'thread_exception',
      original_error: error
    )

    {
      persona: persona,
      result: BaseAiAdapter::JudgmentResult.new(
        succeeded: false,
        error_code: judge_error.error_code,
        scores: nil,
        comment: nil
      )
    }
  end

  # タイムアウト処理
  def handle_timeout(persona)
    judge_error = JudgeError.new(
      judge_persona: persona,
      error_code: 'timeout',
      original_error: nil
    )
    Rails.logger.error("[JudgePostService] #{judge_error.message}")

    {
      persona: persona,
      result: BaseAiAdapter::JudgmentResult.new(
        succeeded: false,
        error_code: judge_error.error_code,
        scores: nil,
        comment: nil
      )
    }
  end

  # Executorのシャットダウン
  def shutdown_executor
    return unless @executor

    @executor.shutdown
    unless @executor.wait_for_termination(EXECUTOR_SHUTDOWN_WAIT_SECONDS)
      @executor.kill
      Rails.logger.warn('[JudgePostService] Executor killed after timeout')
    end
  rescue StandardError => e
    Rails.logger.error("[JudgePostService] Executor shutdown error: #{e.class}")
  end

  # ThreadPool executorを取得（遅延初期化）
  def executor
    @executor ||= Concurrent::ThreadPoolExecutor.new(
      min_threads: EXECUTOR_THREAD_COUNT,
      max_threads: EXECUTOR_THREAD_COUNT,
      max_queue: EXECUTOR_MAX_QUEUE,
      fallback_policy: :caller_runs
    )
  end

  def resolve_adapter_class(adapter_setting)
    return send(adapter_setting) if adapter_setting.is_a?(Symbol)

    adapter_setting
  end

  # 審査結果を保存する
  def save_judgments!(results)
    @successful_judgments = []

    results.each do |data|
      next unless data

      persona = data[:persona]
      result = data[:result]

      attrs = build_judgment_attrs(result)

      # 条件なし書き込みを実行
      put_item_without_condition(@post.id, persona, attrs)

      next unless result.succeeded

      @successful_judgments << build_successful_judgment(persona, attrs)
    end
  end

  # DynamoDBに条件なしでアイテムを書き込む
  def put_item_without_condition(post_id, persona, attrs)
    client = Dynamoid.adapter.client
    table_name = Judgment.table_name
    now = Time.now.to_f

    item = {
      post_id: post_id,
      persona: persona,
      created_at: now,
      updated_at: now
    }.merge(attrs)

    client.put_item(
      table_name: table_name,
      item: item
    )
  end

  def skip_processed_post
    Rails.logger.info("[JudgePostService] スキップ(処理済み): post_id=#{@post.id}, status=#{@post.status}")
    nil
  end

  def skip_claimed_post
    Rails.logger.info("[JudgePostService] スキップ(claim競合): post_id=#{@post.id}, status=#{@post.status}")
    nil
  end

  def skip_by_claim_result(claim_result)
    return skip_processed_post if claim_result == :already_processed
    return skip_claimed_post if claim_result == :claimed_by_other

    skip_processed_post
  end

  def claim_post_for_judging!
    return :already_processed if @post.status != Post::STATUS_JUDGING

    now = Time.current.to_i
    Dynamoid.adapter.client.update_item(
      table_name: Post.table_name,
      key: { id: @post.id },
      update_expression: 'SET #claim = :now',
      condition_expression: '#status = :judging AND (attribute_not_exists(#claim) OR #claim < :expired_at)',
      expression_attribute_names: {
        '#status' => 'status',
        '#claim' => Post::CLAIM_FIELD
      },
      expression_attribute_values: {
        ':judging' => Post::STATUS_JUDGING,
        ':now' => now,
        ':expired_at' => now - CLAIM_STALE_SECONDS
      }
    )
    :claimed
  rescue Aws::DynamoDB::Errors::ConditionalCheckFailedException
    :claimed_by_other
  end

  def build_judgment_attrs(result)
    attrs = {
      id: SecureRandom.uuid,
      succeeded: result.succeeded,
      error_code: result.error_code,
      judged_at: Time.now.to_i.to_s
    }
    return attrs unless result.succeeded

    attrs.merge(
      empathy: result.scores[:empathy],
      humor: result.scores[:humor],
      brevity: result.scores[:brevity],
      originality: result.scores[:originality],
      expression: result.scores[:expression],
      total_score: Judgment.calculate_total_score(result.scores),
      comment: result.comment
    )
  end

  def build_successful_judgment(persona, attrs)
    Judgment.new(
      post_id: @post.id,
      persona: persona,
      **attrs
    )
  end
end
