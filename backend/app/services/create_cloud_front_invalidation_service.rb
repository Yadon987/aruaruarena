# frozen_string_literal: true

# CloudFront の特定パスを個別 invalidation するサービス
class CreateCloudFrontInvalidationService
  API_REGION = 'us-east-1'

  def self.call(path:, post_id:)
    new(path:, post_id:).execute
  end

  def initialize(path:, post_id:)
    @path = path
    @post_id = post_id
  end

  def execute
    return false if distribution_id.empty?
    return true if invalidation_succeeded?

    write_failure_log(last_response.code)
    false
  rescue StandardError => e
    write_exception_log(e)
    false
  end

  private

  def invalidation_succeeded?
    client.create_invalidation(
      distribution_id: distribution_id,
      invalidation_batch: invalidation_batch
    )

    write_success_log
    true
  end

  def distribution_id
    ENV.fetch('CLOUDFRONT_DISTRIBUTION_ID', '').strip
  end

  def client
    @client ||= Aws::CloudFront::Client.new(region: API_REGION)
  end

  def invalidation_batch
    {
      paths: {
        quantity: 1,
        items: [@path]
      },
      caller_reference: "ogp-#{@post_id}-#{Time.current.to_i}"
    }
  end

  def write_success_log
    Rails.logger.info(
      "[CreateCloudFrontInvalidationService] CloudFront invalidation成功: post_id=#{@post_id}, path=#{@path}"
    )
  end

  def write_failure_log(status_code)
    Rails.logger.warn(
      "[CreateCloudFrontInvalidationService] CloudFront invalidation失敗: post_id=#{@post_id}, path=#{@path}, " \
      "status=#{status_code}"
    )
  end

  def write_exception_log(error)
    status_code = cloudfront_status_code(error)
    Rails.logger.warn(
      "[CreateCloudFrontInvalidationService] CloudFront invalidation例外: post_id=#{@post_id}, path=#{@path}, " \
      "error=#{error.class} - #{error.message}, status=#{status_code}"
    )
  end

  def cloudfront_status_code(error)
    return nil unless error.respond_to?(:context)

    error.context.http_response.status_code
  rescue StandardError
    nil
  end
end
