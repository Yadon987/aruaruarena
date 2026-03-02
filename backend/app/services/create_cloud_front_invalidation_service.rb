# frozen_string_literal: true

require 'net/http'
require 'uri'

# CloudFront の特定パスを個別 invalidation するサービス
class CreateCloudFrontInvalidationService
  API_ENDPOINT = 'https://cloudfront.amazonaws.com'
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
    response = submit_invalidation_request
    @last_response = response
    return false unless response.is_a?(Net::HTTPCreated)

    write_success_log
    true
  end

  def submit_invalidation_request
    Net::HTTP.start(request_uri.host, request_uri.port, use_ssl: true) do |http|
      http.request(build_request)
    end
  end

  attr_reader :last_response

  def distribution_id
    ENV.fetch('CLOUDFRONT_DISTRIBUTION_ID', '').strip
  end

  def request_uri
    URI("#{API_ENDPOINT}/2020-05-31/distribution/#{distribution_id}/invalidation")
  end

  def build_request
    request = Net::HTTP::Post.new(request_uri)
    signed_headers.each { |key, value| request[key] = value }
    request.body = request_body
    request
  end

  def signed_headers
    signer.sign_request(
      http_method: 'POST',
      url: request_uri,
      headers: { 'content-type' => 'application/xml' },
      body: request_body
    ).headers
  end

  def signer
    Aws::Sigv4::Signer.new(
      service: 'cloudfront',
      region: API_REGION,
      access_key_id: ENV.fetch('AWS_ACCESS_KEY_ID'),
      secret_access_key: ENV.fetch('AWS_SECRET_ACCESS_KEY'),
      session_token: ENV.fetch('AWS_SESSION_TOKEN', nil)
    )
  end

  def request_body
    <<~XML
      <InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
        <Paths>
          <Quantity>1</Quantity>
          <Items>
            <Path>#{@path}</Path>
          </Items>
        </Paths>
        <CallerReference>ogp-#{@post_id}-#{Time.current.to_i}</CallerReference>
      </InvalidationBatch>
    XML
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
    Rails.logger.warn(
      "[CreateCloudFrontInvalidationService] CloudFront invalidation例外: post_id=#{@post_id}, path=#{@path}, " \
      "error=#{error.class} - #{error.message}"
    )
  end
end
