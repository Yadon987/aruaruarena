# frozen_string_literal: true

# ローカル開発用の審査ワーカー
#
# ローカルDynamoDBに保存された judging 投稿を巡回し、
# 本番と同じ JudgePostService を別プロセスで実行する。
class LocalJudgmentWorkerService
  DEFAULT_POLL_INTERVAL_SECONDS = 2
  DEFAULT_BATCH_SIZE = 10

  def initialize(logger: Rails.logger, poll_interval: DEFAULT_POLL_INTERVAL_SECONDS, batch_size: DEFAULT_BATCH_SIZE)
    @logger = logger
    @poll_interval = poll_interval
    @batch_size = batch_size
  end

  def run
    logger.info('[LocalJudgmentWorker] ワーカーを起動しました')
    LocalJudgmentWorkerHeartbeatService.mark_running!(processed_count: 0)

    loop do
      processed_count = run_once
      LocalJudgmentWorkerHeartbeatService.mark_running!(processed_count:)
      sleep poll_interval if processed_count.zero?
    end
  rescue Interrupt
    logger.info('[LocalJudgmentWorker] ワーカーを停止しました')
    LocalJudgmentWorkerHeartbeatService.mark_stopped!
  end

  def run_once
    processed_count = fetch_pending_posts.count do |post|
      process_post(post)
      true
    rescue StandardError => e
      logger.error("[LocalJudgmentWorker] 審査失敗: post_id=#{post.id}, error=#{e.class} - #{e.message}")
      false
    end

    LocalJudgmentWorkerHeartbeatService.mark_running!(processed_count:)
    processed_count
  end

  private

  attr_reader :logger, :poll_interval, :batch_size

  def fetch_pending_posts
    Post.where(status: Post::STATUS_JUDGING)
        .record_limit(batch_size)
        .to_a
        .sort_by { |post| post.created_at.to_i }
  end

  def process_post(post)
    logger.info("[LocalJudgmentWorker] 審査開始: post_id=#{post.id}")
    JudgePostService.call(post.id)
  end
end
