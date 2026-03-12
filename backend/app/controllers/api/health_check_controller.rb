# frozen_string_literal: true

module Api
  # APIヘルスチェック用コントローラー
  class HealthCheckController < ApplicationController
    include HealthCheckable

    def index
      missing_vars = AiSecretHealthCheckService.missing_env_vars(required_env_vars)
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
  end
end
