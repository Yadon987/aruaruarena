# frozen_string_literal: true

module Api
  # APIヘルスチェック用コントローラー
  class HealthCheckController < ApplicationController
    # 必須環境変数のリスト
    REQUIRED_ENV_VARS = %w[
      SECRET_KEY_BASE
      DYNAMODB_TABLE_POSTS
      SQS_QUEUE_URL
      GEMINI_API_KEY
      CEREBRAS_API_KEY
      GROQ_API_KEY
    ].freeze

    def index
      missing_vars = REQUIRED_ENV_VARS.select { |var| ENV[var].to_s.strip == '' }

      if missing_vars.empty?
        render json: { status: 'ok', environment: Rails.env, timestamp: Time.current }, status: :ok
      else
        Rails.logger.error("[HealthCheck] Missing required env vars: #{missing_vars.join(', ')}")
        render json: {
          status: 'unhealthy',
          error: 'Missing required environment variables',
          missing: missing_vars,
          timestamp: Time.current
        }, status: :service_unavailable
      end
    end
  end
end
