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
    return false unless processable_post?

    mark_generating!
    uploaded = UploadOgpImageService.call(@post)
    return mark_ready_result if uploaded

    mark_failed_result
  rescue StandardError => e
    mark_ogp_failed! if @post
    Rails.logger.error("[ProcessOgpImageService] OGP画像生成に失敗: post_id=#{@post&.id} error=#{e.class} - #{e.message}")
    false
  end

  class << self
    def call(post_id)
      new(post_id).execute
    end
  end

  private

  def processable_post?
    return false if @post.nil?
    return false unless @post.status == Post::STATUS_SCORED
    return false if [Post::OGP_STATUS_READY, Post::OGP_STATUS_GENERATING].include?(@post.ogp_status)

    true
  end

  def mark_generating!
    @post.update_ogp_status!(Post::OGP_STATUS_GENERATING)
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
end
