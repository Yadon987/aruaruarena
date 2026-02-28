# frozen_string_literal: true

require 'concurrent'

# JudgePostService - 投稿のAI審査を実行するサービス
#
# 3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）による
# 並列審査を実行し、その結果をDynamoDBに保存します。
class JudgePostService
  # 審査員の設定
  JUDGES = [
    { persona: 'hiroyuki', adapter: GeminiAdapter },
    { persona: 'dewi',     adapter: :dewi_adapter_class },
    { persona: 'nakao',    adapter: OpenAiAdapter }
  ].freeze

  # タイムアウト設定（Lambda環境を考慮）
  PER_JUDGE_TIMEOUT = 70  # 各審査員のタイムアウト（秒）
  JOIN_TIMEOUT = 90       # 全体のタイムアウト（秒）

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

    # Concurrent::Futureを使用して並列審査を実行
    futures = JUDGES.map do |judge|
      Concurrent::Future.execute(executor: executor) do
        persona = judge[:persona]
        result = nil

        begin
          Rails.logger.info("[JudgePostService] 審査開始: persona=#{persona}")

          adapter_class = resolve_adapter_class(judge[:adapter])
          adapter = adapter_class.new
          result = adapter.judge(@post.body, persona: persona)

          if result.succeeded
            Rails.logger.info("[JudgePostService] 審査成功: persona=#{persona}")
          else
            Rails.logger.warn("[JudgePostService] 審査失敗: persona=#{persona}, error_code=#{result.error_code}")
          end
        rescue StandardError => e
          # JudgeErrorで例外情報をラップ
          judge_error = JudgeError.new(
            judge_persona: persona,
            error_code: 'thread_exception',
            original_error: e
          )
          Rails.logger.error("[JudgePostService] #{judge_error.message}")
          result = BaseAiAdapter::JudgmentResult.new(
            succeeded: false,
            error_code: judge_error.error_code,
            scores: nil,
            comment: nil
          )
        end

        { persona: persona, result: result }
      end
    end

    # タイムアウト付きでFutureを待機
    results = futures.each_with_index.map do |future, idx|
      result = future.value(PER_JUDGE_TIMEOUT)

      # タイムアウトした場合
      if result.nil?
        persona = JUDGES[idx][:persona]
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
      else
        result
      end
    end

    save_judgments!(results)
    update_post_status!
  ensure
    # Executorをシャットダウン（リソースリーク防止）
    begin
      @executor&.shutdown
      @executor&.wait_for_termination(5)
    rescue StandardError => e
      Rails.logger.error("[JudgePostService] Executor shutdown error: #{e.class}")
    end
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

  # ThreadPool executorを取得（遅延初期化）
  #
  # @return [Concurrent::ThreadPoolExecutor] スレッドプール
  def executor
    @executor ||= Concurrent::ThreadPoolExecutor.new(
      min_threads: 3,
      max_threads: 3,
      max_queue: 0,
      fallback_policy: :caller_runs
    )
  end

  def resolve_adapter_class(adapter_setting)
    return send(adapter_setting) if adapter_setting.is_a?(Symbol)

    adapter_setting
  end

  def dewi_adapter_class
    # テスト環境は既存spec互換のため従来アダプターを固定利用する
    return DewiAdapter if Rails.env.test?

    return CerebrasAdapter if ENV['CEREBRAS_API_KEY'].to_s.strip != ''

    DewiAdapter
  end

  # 審査結果を保存する
  # DynamoDB Localの整合性問題を回避するため、条件なし書き込みを使用
  def save_judgments!(results)
    @successful_judgments = []

    results.each do |data|
      next unless data

      persona = data[:persona]
      result = data[:result]

      # 属性を構築
      attrs = {
        id: SecureRandom.uuid,
        succeeded: result.succeeded,
        error_code: result.error_code,
        judged_at: Time.now.to_i.to_s
      }

      if result.succeeded
        attrs.merge!(
          empathy: result.scores[:empathy],
          humor: result.scores[:humor],
          brevity: result.scores[:brevity],
          originality: result.scores[:originality],
          expression: result.scores[:expression],
          total_score: Judgment.calculate_total_score(result.scores),
          comment: result.comment
        )
      end

      # 条件なし書き込みを実行（DynamoDB Localの整合性問題を回避）
      put_item_without_condition(@post.id, persona, attrs)

      # successful_judgmentsに追加（保存したデータから直接構築）
      next unless result.succeeded

      judgment = Judgment.new(
        post_id: @post.id,
        persona: persona,
        **attrs.symbolize_keys
      )
      # total_scoreを設定（already included in attrs, but ensure it's set）
      judgment.total_score ||= Judgment.calculate_total_score(result.scores)
      @successful_judgments << judgment
    end
  end

  # DynamoDBに条件なしでアイテムを書き込む
  # @param post_id [String] パーティションキー
  # @param persona [String] ソートキー
  # @param attrs [Hash] 属性ハッシュ
  def put_item_without_condition(post_id, persona, attrs)
    client = Dynamoid.adapter.client
    table_name = Judgment.table_name

    # 現在時刻を取得
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

  # ステータスを更新する
  def update_post_status!
    succeeded_count = @successful_judgments.size

    @post.judges_count = succeeded_count

    if succeeded_count >= 2
      calculate_average_score!
      @post.update_status!(:scored)
      Rails.logger.info("[JudgePostService] 審査完了: status=scored, post_id=#{@post.id}, judges_count=#{succeeded_count}")
    else
      @post.update_status!(:failed)
      Rails.logger.info("[JudgePostService] 審査失敗: status=failed, post_id=#{@post.id}, judges_count=#{succeeded_count}")
    end
  end

  # 平均点を計算する
  def calculate_average_score!
    return if @successful_judgments.empty?

    total = @successful_judgments.sum(&:total_score)
    # 四捨五入で小数第1位に丸める（85.35 -> 85.4, 85.34 -> 85.3）
    @post.average_score = (total.to_f / @successful_judgments.size).round(1)
  end
end
