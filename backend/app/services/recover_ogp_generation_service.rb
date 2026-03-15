# frozen_string_literal: true

# OGP生成状態の取りこぼしを自己回復するサービス
class RecoverOgpGenerationService
  PENDING_RETRY_SECONDS = ENV.fetch('OGP_PENDING_RETRY_SECONDS', 30).to_i
  GENERATING_RETRY_SECONDS = ENV.fetch('OGP_GENERATING_RETRY_SECONDS', 180).to_i
  RECOVERABLE_STATUSES = [Post::OGP_STATUS_PENDING, Post::OGP_STATUS_GENERATING].freeze

  def initialize(post)
    @post = post
  end

  def execute
    return false unless recoverable?
    return reconcile_ready! if uploaded_image_exists?

    case @post.ogp_status
    when Post::OGP_STATUS_PENDING
      retry_pending!
    when Post::OGP_STATUS_GENERATING
      retry_stale_generating!
    else
      false
    end
  end

  class << self
    def call(post)
      new(post).execute
    end
  end

  private

  def recoverable?
    @post.present? &&
      @post.status == Post::STATUS_SCORED &&
      RECOVERABLE_STATUSES.include?(@post.ogp_status)
  end

  def uploaded_image_exists?
    return false if ENV.fetch('OGP_S3_BUCKET', '').strip.empty?

    OgpMetaTagService.uploaded_image_exists?(post: @post)
  end

  def reconcile_ready!
    updated = update_status_to_ready
    Rails.logger.info("[RecoverOgpGenerationService] 生成済み画像を検知してreadyへ補正: post_id=#{@post.id}") if updated
    updated
  end

  def update_status_to_ready
    @post.update_ogp_status_if_current(
      from: RECOVERABLE_STATUSES,
      to: Post::OGP_STATUS_READY,
      required_status: Post::STATUS_SCORED
    )
  end

  def retry_pending!
    return false unless post_age_seconds >= PENDING_RETRY_SECONDS

    moved = @post.update_ogp_status_if_current(
      from: Post::OGP_STATUS_PENDING,
      to: Post::OGP_STATUS_GENERATING,
      required_status: Post::STATUS_SCORED
    )
    return false unless moved

    enqueue_retry!('pending_retry')
  end

  def retry_stale_generating!
    return false unless post_age_seconds >= GENERATING_RETRY_SECONDS

    reset = @post.update_ogp_status_if_current(
      from: Post::OGP_STATUS_GENERATING,
      to: Post::OGP_STATUS_PENDING,
      required_status: Post::STATUS_SCORED
    )
    return false unless reset

    enqueue_retry!('stale_generating_retry')
  end

  def enqueue_retry!(reason)
    JudgmentQueueService.enqueue_ogp_generation(@post.id)
    Rails.logger.warn("[RecoverOgpGenerationService] OGP再投入: reason=#{reason} post_id=#{@post.id}")
    true
  rescue StandardError => e
    log_retry_error(reason, e)
    false
  end

  def log_retry_error(reason, error)
    Rails.logger.error(
      "[RecoverOgpGenerationService] OGP再投入失敗: reason=#{reason} post_id=#{@post.id} " \
      "error=#{error.class} - #{error.message}"
    )
  end

  def post_age_seconds
    created_at_unix = @post.created_at.to_i
    return 0 if created_at_unix <= 0

    Time.current.to_i - created_at_unix
  end
end
