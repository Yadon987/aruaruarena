# frozen_string_literal: true

# OGP画像生成ジョブの状態遷移を管理するサービス
class ProcessOgpImageService
  def initialize(post_id)
    @post = Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[ProcessOgpImageService] Post not found: #{post_id}")
    @post = nil
  end

  def execute
    return false unless try_mark_generating!

    uploaded = UploadOgpImageService.call(@post)
    return mark_ready_result if uploaded

    mark_failed_result
  rescue StandardError => e
    handle_execution_error(e)
  end

  class << self
    def call(post_id)
      new(post_id).execute
    end
  end

  private

  def try_mark_generating!
    return false if @post.nil?
    return false unless @post.status == Post::STATUS_SCORED

    @post.update_ogp_status_if_current(
      from: [Post::OGP_STATUS_PENDING, Post::OGP_STATUS_FAILED],
      to: Post::OGP_STATUS_GENERATING,
      required_status: Post::STATUS_SCORED
    )
  end

  def mark_ogp_ready!
    @post.update_ogp_status!(Post::OGP_STATUS_READY)
  end

  def mark_ogp_failed!
    @post.update_ogp_status!(Post::OGP_STATUS_FAILED)
  end

  # rubocop:disable Naming/PredicateMethod
  def mark_ready_result
    mark_ogp_ready!
    true
  end

  def mark_failed_result
    mark_ogp_failed!
    false
  end
  # rubocop:enable Naming/PredicateMethod

  # rubocop:disable Naming/PredicateMethod
  def handle_execution_error(error)
    mark_failed_on_error
    Rails.logger.error(
      "[ProcessOgpImageService] OGP画像生成に失敗: post_id=#{@post&.id} " \
      "error=#{error.class} - #{error.message}"
    )
    false
  end
  # rubocop:enable Naming/PredicateMethod

  def mark_failed_on_error
    return unless @post

    mark_ogp_failed!
  rescue StandardError => e
    Rails.logger.error(
      "[ProcessOgpImageService] ogp_status=failedの更新に失敗: post_id=#{@post.id} " \
      "error=#{e.class} - #{e.message}"
    )
  end
end
