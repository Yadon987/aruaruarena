# frozen_string_literal: true

# 生成済みOGP画像をS3へ保存するサービス
class UploadOgpImageService
  OGP_S3_PREFIX = 'ogp/posts'
  CACHE_CONTROL = 'max-age=604800, public'

  # Postオブジェクトまたはpost_idを受け取る
  # DynamoDBの結果的整合性問題を回避するため、Postオブジェクトを直接渡すことを推奨
  def initialize(post_or_id, s3_client:)
    @post = post_or_id.is_a?(Post) ? post_or_id : fetch_post(post_or_id)
    @s3_client = s3_client
  end

  def fetch_post(post_id)
    Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[UploadOgpImageService] Post not found: #{post_id}")
    nil
  end

  def execute
    upload?
  rescue Aws::S3::Errors::ServiceError => e
    Rails.logger.error("[UploadOgpImageService] S3 upload failed: post_id=#{@post&.id} error=#{e.class} - #{e.message}")
    false
  rescue StandardError => e
    Rails.logger.error("[UploadOgpImageService] Unexpected error: post_id=#{@post&.id} error=#{e.class} - #{e.message}")
    false
  end

  class << self
    # Postオブジェクトまたはpost_idを受け取る
    # DynamoDBの結果的整合性問題を回避するため、Postオブジェクトを直接渡すことを推奨
    def call(post_or_id, s3_client: nil)
      if bucket_name.empty?
        Rails.logger.error('[UploadOgpImageService] OGP_S3_BUCKET environment variable is not set')
        return false
      end

      new(post_or_id, s3_client: s3_client || build_s3_client).execute
    end

    private

    def bucket_name
      ENV.fetch('OGP_S3_BUCKET', '').strip
    end

    def build_s3_client
      Aws::S3::Client.new(
        region: aws_region,
        http_open_timeout: 5,
        http_read_timeout: 5
      )
    end

    def aws_region
      ENV.fetch('AWS_REGION', 'ap-northeast-1')
    end
  end

  private

  def valid_post?
    @post.present? && @post.status == Post::STATUS_SCORED
  end

  def upload?
    return false unless valid_post?
    return false if bucket_name.empty?

    image_data = generate_ogp_image
    return false if image_data.nil?

    upload_image(image_data)
    log_upload_metrics
    log_upload_success
    CreateCloudFrontInvalidationService.call(path: invalidation_path, post_id: @post.id)
    true
  end

  def bucket_name
    ENV.fetch('OGP_S3_BUCKET', '').strip
  end

  def object_key
    "#{OGP_S3_PREFIX}/#{@post.id}.png"
  end

  def invalidation_path
    "/#{object_key}"
  end

  def upload_image(image_data)
    @s3_client.put_object(
      bucket: bucket_name,
      key: object_key,
      body: image_data,
      content_type: 'image/png',
      cache_control: CACHE_CONTROL
    )
  end

  def generate_ogp_image
    LogOgpGenerationEventService.call(event: 'ogp_generation_started', post: @post)
    OgpGeneratorService.call(@post)
  end

  def log_upload_metrics
    LogOgpGenerationEventService.call(
      event: 'ogp_s3_upload_succeeded',
      post: @post,
      bucket_name:,
      object_key:
    )
  end

  def log_upload_success
    Rails.logger.info("[UploadOgpImageService] OGP画像アップロード成功: post_id=#{@post.id}, key=#{object_key}")
  end
end
