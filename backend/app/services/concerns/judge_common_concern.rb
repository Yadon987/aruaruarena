# frozen_string_literal: true

# Judge系サービスで共有する投稿ステータス更新処理
module JudgeCommonConcern
  extend ActiveSupport::Concern

  SCORING_THRESHOLD = 2
  ROUND_PRECISION = 1

  private

  # 環境に応じてDewi系アダプターを切り替える
  def dewi_adapter_class
    return DewiAdapter if Rails.env.test?
    return CerebrasAdapter if ENV['CEREBRAS_API_KEY'].to_s.strip != ''

    DewiAdapter
  end

  # 成功した審査結果に基づいて投稿ステータスを更新する
  def update_post_status!(post, successful_judgments)
    succeeded_count = successful_judgments.size
    post.judges_count = succeeded_count

    if succeeded_count >= SCORING_THRESHOLD
      update_scored_post!(post, successful_judgments, succeeded_count)
    else
      update_failed_post!(post)
    end
  end

  def enqueue_ogp_generation(post)
    JudgmentQueueService.enqueue_ogp_generation(post.id)
  rescue StandardError => e
    post.update_ogp_status!(Post::OGP_STATUS_FAILED)
    Rails.logger.warn("[#{self.class.name}] OGP画像生成ジョブ投入で例外: post_id=#{post.id} error=#{e.class} - #{e.message}")
  end

  def update_scored_post!(post, successful_judgments, succeeded_count)
    raw_average = average_score_for(successful_judgments, succeeded_count)
    post.average_score = ScoreCalibrationService.calibrate(raw_score: raw_average, post: post)
    persist_scored_post!(post)
    log_scored_post(post, succeeded_count)
  end

  def update_failed_post!(post)
    post.average_score = nil
    post.update_status!(Post::STATUS_FAILED)
  end

  def average_score_for(successful_judgments, succeeded_count)
    return 0.0 if succeeded_count <= 0

    total = successful_judgments.sum(&:total_score)
    (total.to_f / succeeded_count).round(ROUND_PRECISION)
  end

  def persist_scored_post!(post)
    post.ogp_status = Post::OGP_STATUS_PENDING
    post.status = Post::STATUS_SCORED
    post.update_status!(Post::STATUS_SCORED)
    enqueue_ogp_generation(post)
  end

  def log_scored_post(post, succeeded_count)
    LogOgpGenerationEventService.call(
      event: 'post_scored_saved',
      post:,
      successful_judges_count: succeeded_count
    )
  end

  def capped_total_score_for(scores, post, service_name:)
    raw_total_score = Judgment.calculate_total_score(scores)
    capped_score = ScoreManipulationGuardService.cap_total_score(post.body, raw_total_score)
    return capped_score if capped_score == raw_total_score

    Rails.logger.warn("[#{service_name}] 採点誘導文を検知したため合計点を制限: post_id=#{post.id}")
    capped_score
  end
end
