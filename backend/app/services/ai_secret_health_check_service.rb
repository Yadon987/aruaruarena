# frozen_string_literal: true

# AI用シークレットのヘルスチェックサービス
class AiSecretHealthCheckService
  SECRET_MAPPINGS = [
    %w[GEMINI_SECRET_ARN GEMINI_API_KEY],
    %w[CEREBRAS_SECRET_ARN CEREBRAS_API_KEY],
    %w[GROQ_SECRET_ARN GROQ_API_KEY]
  ].freeze

  class << self
    def missing_env_vars(base_required_env_vars)
      base_missing = base_required_env_vars.reject { |var| present?(ENV[var]) }

      return base_missing unless secrets_manager_enabled?

      base_missing.reject { |var| ai_api_env_var?(var) && secret_available_for?(var) }
    end

    private

    def secrets_manager_enabled?
      ENV['SECRETS_MANAGER_ENABLED'] == 'true'
    end

    def ai_api_env_var?(env_var)
      SECRET_MAPPINGS.any? { |_secret_arn_key, api_key_env| api_key_env == env_var }
    end

    def secret_available_for?(env_var)
      secret_arn_key = SECRET_MAPPINGS.find { |_candidate_secret_arn_key, api_key_env| api_key_env == env_var }&.first
      return false unless secret_arn_key

      secret_arn = ENV.fetch(secret_arn_key, nil)
      return false unless present?(secret_arn)

      SecretsManagerClient.get_api_key(secret_arn:, env_key: env_var)
      true
    rescue ArgumentError
      false
    end

    def present?(value)
      value.to_s.strip != ''
    end
  end
end
