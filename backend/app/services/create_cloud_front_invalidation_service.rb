# frozen_string_literal: true

# CloudFront の指定パスを個別 invalidation するサービス
class CreateCloudFrontInvalidationService
  def self.call(path:, post_id:, client: nil)
    new(path:, post_id:, client: client || build_client).execute
  end

  def self.build_client
    Aws::CloudFront::Client.new
  end
  private_class_method :build_client

  def initialize(path:, post_id:, client:)
    @path = path
    @post_id = post_id
    @client = client
  end

  def execute
    return false if distribution_id.empty?

    @client.create_invalidation(request_params)
    log_success
    true
  rescue Aws::CloudFront::Errors::ServiceError => e
    Rails.logger.warn(
      "[CreateCloudFrontInvalidationService] CloudFront invalidation失敗: post_id=#{@post_id}, path=#{@path}, " \
      "error=#{e.class} - #{e.message}"
    )
    false
  end

  private

  def distribution_id
    ENV.fetch('CLOUDFRONT_DISTRIBUTION_ID', '').strip
  end

  def caller_reference
    "ogp-#{@post_id}-#{Time.current.to_i}"
  end

  def request_params
    {
      distribution_id: distribution_id,
      invalidation_batch: {
        paths: {
          quantity: 1,
          items: [@path]
        },
        caller_reference: caller_reference
      }
    }
  end

  def log_success
    Rails.logger.info(
      "[CreateCloudFrontInvalidationService] CloudFront invalidation成功: post_id=#{@post_id}, path=#{@path}"
    )
  end
end
