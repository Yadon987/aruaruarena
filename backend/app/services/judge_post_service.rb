# frozen_string_literal: true

# JudgePostService - 投稿のAI審査を実行するサービス
#
# 3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）による
# 並列審査を実行し、その結果をDynamoDBに保存します。
class JudgePostService
  # 審査員の設定
  JUDGES = [
    { persona: 'hiroyuki', adapter: GeminiAdapter },
    { persona: 'dewi',     adapter: DewiAdapter },
    { persona: 'nakao',    adapter: OpenAiAdapter }
  ].freeze

  # タイムアウト設定（Lambda環境を考慮）
  JOIN_TIMEOUT = 120 # 全体のタイムアウト（秒）

  # 初期化
  #
  # @param post_id [String] 投稿ID
  def initialize(post_id)
    @post = Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound
    Rails.logger.warn("[JudgePostService] Post not found: #{post_id}")
    @post = nil
  end

  # 投稿の審査を実行
  #
  # @return [void]
  def execute
    return if @post.nil?

    results = {}
    results_mutex = Mutex.new

    threads = JUDGES.map do |judge|
      Thread.new do
        persona = judge[:persona]
        result = nil

        begin
          Rails.logger.info("[JudgePostService] 審査開始: persona=#{persona}")

          adapter = judge[:adapter].new
          result = adapter.judge(@post.body, persona: persona)

          if result.succeeded
            Rails.logger.info("[JudgePostService] 審査成功: persona=#{persona}")
          else
            Rails.logger.warn("[JudgePostService] 審査失敗: persona=#{persona}, error_code=#{result.error_code}")
          end
        rescue StandardError => e
          # e.message にはAPIキー等の機密情報が含まれる可能性があるため、クラス名のみ記録
          Rails.logger.error("[JudgePostService] 審査例外: persona=#{persona}, error_class=#{e.class}")
          result = BaseAiAdapter::JudgmentResult.new(
            succeeded: false,
            error_code: 'thread_exception',
            scores: nil,
            comment: nil
          )
        ensure
          # 結果をスレッドセーフに格納
          results_mutex.synchronize do
            results[persona] = { persona: persona, result: result }
          end
        end
      end
    end

    # タイムアウト付きでThreadを待機
    threads.each do |thread|
      next if thread.join(JOIN_TIMEOUT)

      # タイムアウトしたスレッドは強制終了せず、自然終了を待つ
      # 結果が未設定の場合はタイムアウトとして記録
      persona = thread[:persona]
      results_mutex.synchronize do
        results[persona] ||= {
          persona: persona,
          result: BaseAiAdapter::JudgmentResult.new(
            succeeded: false,
            error_code: 'timeout',
            scores: nil,
            comment: nil
          )
        }
      end
      Rails.logger.error("[JudgePostService] Thread timeout: persona=#{persona}")
    end

    # 結果を配列に変換
    results_array = results.values

    save_judgments!(results_array)
    update_post_status!
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

  # 審査結果を保存する
  def save_judgments!(results)
    @successful_judgments = []

    results.each do |data|
      next unless data

      persona = data[:persona]
      result = data[:result]

      judgment = Judgment.new(
        post_id: @post.id,
        persona: persona,
        id: SecureRandom.uuid,
        succeeded: result.succeeded,
        error_code: result.error_code,
        judged_at: Time.now.to_i.to_s
      )

      if result.succeeded
        judgment.assign_attributes(
          empathy: result.scores[:empathy],
          humor: result.scores[:humor],
          brevity: result.scores[:brevity],
          originality: result.scores[:originality],
          expression: result.scores[:expression],
          total_score: Judgment.calculate_total_score(result.scores),
          comment: result.comment
        )
        @successful_judgments << judgment
      end

      judgment.save!
    end
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
