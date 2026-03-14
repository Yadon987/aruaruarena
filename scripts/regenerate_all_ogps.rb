# frozen_string_literal: true

require_relative '../backend/config/environment'

# scored投稿のOGP画像を全件再生成してS3へ保存するスクリプト
logger = Logger.new($stdout)
logger.level = Logger::INFO

logger.info 'OGP画像の全件再生成を開始します'

scored_posts = Post.where(status: Post::STATUS_SCORED).to_a
logger.info "対象件数: #{scored_posts.size}件"

scored_posts.each do |post|
  logger.info "処理開始: post_id=#{post.id}"

  if UploadOgpImageService.call(post)
    logger.info "処理成功: post_id=#{post.id}"
  else
    logger.error "処理失敗: post_id=#{post.id}"
  end
rescue StandardError => e
  logger.error "例外発生: post_id=#{post.id} error=#{e.class} - #{e.message}"
end

logger.info 'OGP画像の全件再生成が完了しました'
