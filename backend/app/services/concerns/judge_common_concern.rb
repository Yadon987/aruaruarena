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

  # OGP画像の事前生成を行う
  # Postオブジェクトを直接渡すことで、DynamoDBの結果的整合性問題を回避
  def upload_ogp_image(post)
    return if UploadOgpImageService.call(post)

    Rails.logger.warn("[#{self.class.name}] OGP画像の事前生成に失敗: post_id=#{post.id}")
  rescue StandardError => e
    Rails.logger.warn("[#{self.class.name}] OGP画像の事前生成で例外: post_id=#{post.id} error=#{e.class} - #{e.message}")
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
    total = successful_judgments.sum(&:total_score)
    (total.to_f / succeeded_count).round(ROUND_PRECISION)
  end

  def persist_scored_post!(post)
    post.status = Post::STATUS_SCORED
    upload_ogp_image(post)
    post.update_status!(Post::STATUS_SCORED)
  end

  def log_scored_post(post, succeeded_count)
    LogOgpGenerationEventService.call(
      event: 'post_scored_saved',
      post:,
      successful_judges_count: succeeded_count
    )
  end
end
