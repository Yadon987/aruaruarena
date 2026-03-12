# frozen_string_literal: true

# health checkコントローラー向けの共通判定ロジック
module HealthCheckable
  extend ActiveSupport::Concern

  BASE_REQUIRED_ENV_VARS = %w[
    SECRET_KEY_BASE
    DYNAMODB_TABLE_POSTS
    GEMINI_API_KEY
    CEREBRAS_API_KEY
    GROQ_API_KEY
  ].freeze

  private

  def required_env_vars
    vars = BASE_REQUIRED_ENV_VARS.dup
    vars << 'SQS_QUEUE_URL' unless local_worker_mode? || synchronous_mode?
    vars
  end

  def local_worker_mode?
    Rails.env.development? && ENV['LOCAL_JUDGE_WORKER'] == 'true'
  end

  def synchronous_mode?
    Rails.env.development? && ENV['SYNCHRONOUS_JUDGE'] == 'true'
  end

  def build_worker_status
    return nil if synchronous_mode?
    return nil unless local_worker_mode?

    LocalJudgmentWorkerHeartbeatService.current_status
  end

  def health_check_response
    missing_vars = AiSecretHealthCheckService.missing_env_vars(required_env_vars)
    worker_status = build_worker_status
    return missing_env_response(missing_vars, worker_status) if missing_vars.any?
    return worker_unhealthy_response(worker_status) if worker_unhealthy?(worker_status)

    ok_response(worker_status)
  end

  def worker_unhealthy?(worker_status)
    worker_status&.dig('status') == 'unhealthy'
  end

  def missing_env_response(missing_vars, worker_status)
    Rails.logger.error("[HealthCheck] Missing required env vars: #{missing_vars.join(', ')}")
    response_with_status(missing_env_payload(missing_vars, worker_status), :service_unavailable)
  end

  def worker_unhealthy_response(worker_status)
    Rails.logger.error("[HealthCheck] Local judgment worker unavailable: #{worker_status['reason']}")
    response_with_status(worker_unhealthy_payload(worker_status), :service_unavailable)
  end

  def ok_response(worker_status)
    response_with_status(ok_payload(worker_status), :ok)
  end

  def response_with_status(payload, http_status)
    { payload: payload, http_status: http_status }
  end

  def missing_env_payload(missing_vars, worker_status)
    payload = service_unavailable_payload
    return payload unless detailed_health_response?

    merge_detailed_payload(payload,
                           error: 'Missing required environment variables',
                           missing: missing_vars,
                           environment: Rails.env,
                           worker: sanitized_worker_status(worker_status))
  end

  def worker_unhealthy_payload(worker_status)
    payload = service_unavailable_payload
    return payload unless detailed_health_response?

    merge_detailed_payload(payload,
                           error: 'Local judgment worker is not running',
                           environment: Rails.env,
                           worker: sanitized_worker_status(worker_status))
  end

  def ok_payload(worker_status)
    payload = {
      status: 'ok',
      timestamp: Time.current
    }
    return payload unless detailed_health_response?

    payload.merge(
      environment: Rails.env,
      worker: sanitized_worker_status(worker_status)
    )
  end

  def detailed_health_response?
    Rails.env.development? || ENV['HEALTH_CHECK_VERBOSE'] == 'true'
  end

  def sanitized_worker_status(worker_status)
    return nil unless worker_status

    worker_status.slice('mode', 'status', 'reason', 'updated_at', 'processed_count')
  end

  def merge_detailed_payload(payload, **details)
    payload.merge(details)
  end

  def service_unavailable_payload
    {
      status: 'unhealthy',
      error: 'Service unavailable',
      timestamp: Time.current
    }
  end
end
