# frozen_string_literal: true

require 'aws-sigv4'
require 'aws-sdk-core'
require 'json'
require 'net/http'
require 'uri'

# 投稿審査メッセージを SQS に送るサービス
class JudgmentQueueService
  API_VERSION = '2012-11-05'
  CONTENT_TYPE = 'application/x-www-form-urlencoded; charset=utf-8'

  class << self
    delegate :enqueue, to: :new
  end

  def enqueue(post_id)
    uri = URI.parse(queue_url)
    request = build_request(uri, post_id)
    apply_signed_headers!(request, sign_headers(uri, request))
    validate_response!(send_request(uri, request))
  end

  private

  def queue_url
    ENV.fetch('SQS_QUEUE_URL') do
      raise 'SQS_QUEUE_URL が設定されていません'
    end
  end

  def build_request(uri, post_id)
    request = Net::HTTP::Post.new(uri.request_uri)
    request['Content-Type'] = CONTENT_TYPE
    request.body = URI.encode_www_form(
      'Action' => 'SendMessage',
      'Version' => API_VERSION,
      'MessageBody' => { post_id: post_id }.to_json
    )
    request
  end

  def sign_headers(uri, request)
    signer.sign_request(
      http_method: 'POST',
      url: uri.to_s,
      headers: {
        'content-type' => CONTENT_TYPE,
        'host' => uri.host
      },
      body: request.body
    ).headers
  end

  def apply_signed_headers!(request, signed_headers)
    signed_headers.each { |key, value| request[key] = value }
  end

  def send_request(uri, request)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
      http.request(request)
    end
  end

  def validate_response!(response)
    return response if response.is_a?(Net::HTTPSuccess)

    raise "SQS enqueue failed: #{response.code} #{response.body}"
  end

  def signer
    @signer ||= Aws::Sigv4::Signer.new(
      service: 'sqs',
      region: ENV.fetch('AWS_REGION', 'ap-northeast-1'),
      credentials: credentials
    )
  end

  def credentials
    access_key_id = ENV.fetch('AWS_ACCESS_KEY_ID') do
      raise 'AWS_ACCESS_KEY_ID が設定されていません'
    end
    secret_access_key = ENV.fetch('AWS_SECRET_ACCESS_KEY') do
      raise 'AWS_SECRET_ACCESS_KEY が設定されていません'
    end

    Aws::Credentials.new(access_key_id, secret_access_key, ENV.fetch('AWS_SESSION_TOKEN', nil))
  end
end
