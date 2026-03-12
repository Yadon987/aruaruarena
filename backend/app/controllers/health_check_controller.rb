# frozen_string_literal: true

# ヘルスチェック用コントローラー
class HealthCheckController < ApplicationController
  BASE_REQUIRED_ENV_VARS = %w[
    SECRET_KEY_BASE
    DYNAMODB_TABLE_POSTS
    GEMINI_API_KEY
    CEREBRAS_API_KEY
    GROQ_API_KEY
  ].freeze

  def index
    missing_vars = required_env_vars.select { |var| ENV[var].to_s.strip == '' }
    worker_status = build_worker_status

    if missing_vars.any?
      Rails.logger.error("[HealthCheck] Missing required env vars: #{missing_vars.join(', ')}")
      render json: {
        status: 'unhealthy',
        error: 'Missing required environment variables',
        missing: missing_vars,
        timestamp: Time.current,
        worker: worker_status
      }, status: :service_unavailable
      return
    end

    if worker_status&.dig('status') == 'unhealthy'
      Rails.logger.error("[HealthCheck] Local judgment worker unavailable: #{worker_status['reason']}")
      render json: {
        status: 'unhealthy',
        error: 'Local judgment worker is not running',
        environment: Rails.env,
        timestamp: Time.current,
        worker: worker_status
      }, status: :service_unavailable
      return
    end

    render json: {
      status: 'ok',
      environment: Rails.env,
      timestamp: Time.current,
      worker: worker_status
    }, status: :ok
  end

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
    return nil unless local_worker_mode?

    LocalJudgmentWorkerHeartbeatService.current_status
  end
end
