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
  JOB_TYPE_JUDGE_POST = 'judge_post'
  JOB_TYPE_GENERATE_OGP = 'generate_ogp'

  class << self
    delegate :enqueue, :enqueue_ogp_generation, to: :new
  end

  def enqueue(post_id)
    return execute_judgment_directly(post_id) if synchronous_mode?
    return register_for_local_worker(post_id) if local_worker_mode?

    enqueue_message(post_id, JOB_TYPE_JUDGE_POST)
  end

  def enqueue_ogp_generation(post_id)
    # local_worker_mode? では enqueue で審査だけを待ち登録し、
    # LocalJudgmentWorkerService は generate_ogp / JOB_TYPE_GENERATE_OGP を処理しない。
    # そのため execute_ogp_generation_directly を使って OGP 生成だけ同期実行する。
    return execute_ogp_generation_directly(post_id) if synchronous_mode? || local_worker_mode?

    enqueue_message(post_id, JOB_TYPE_GENERATE_OGP)
  end

  private

  def enqueue_message(post_id, job_type)
    uri = URI.parse(queue_url)
    request = build_request(uri, build_message_body(post_id, job_type))
    apply_signed_headers!(request, sign_headers(uri, request))
    validate_response!(send_request(uri, request))
  end

  def synchronous_mode?
    Rails.env.development? && ENV['SYNCHRONOUS_JUDGE'] == 'true'
  end

  def local_worker_mode?
    Rails.env.development? && ENV['LOCAL_JUDGE_WORKER'] == 'true'
  end

  def execute_judgment_directly(post_id)
    Rails.logger.info("[JudgmentQueueService] 同期実行モードで審査開始: post_id=#{post_id}")
    JudgePostService.call(post_id)
    nil
  end

  def execute_ogp_generation_directly(post_id)
    Rails.logger.info("[JudgmentQueueService] 同期実行モードでOGP生成開始: post_id=#{post_id}")
    ProcessOgpImageService.call(post_id)
    nil
  end

  def register_for_local_worker(post_id)
    return StartLocalJudgmentFallbackService.call(post_id) unless local_worker_available?

    Rails.logger.info("[JudgmentQueueService] ローカルワーカーモードで審査待ち登録: post_id=#{post_id}")
    nil
  end

  def local_worker_available?
    LocalJudgmentWorkerHeartbeatService.current_status['status'] == 'ok'
  end

  def queue_url = ENV.fetch('SQS_QUEUE_URL') { raise 'SQS_QUEUE_URL が設定されていません' }

  def build_request(uri, message_body)
    request = Net::HTTP::Post.new(uri.request_uri)
    request['Content-Type'] = CONTENT_TYPE
    request.body = URI.encode_www_form(
      'Action' => 'SendMessage',
      'Version' => API_VERSION,
      'MessageBody' => message_body.to_json
    )
    request
  end

  def build_message_body(post_id, job_type)
    { post_id: post_id, job_type: job_type }
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
