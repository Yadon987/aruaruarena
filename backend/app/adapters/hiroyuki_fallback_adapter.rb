# frozen_string_literal: true

# HiroyukiFallbackAdapter - Gemini失敗時の代替プロバイダ用アダプター
#
# GroqのOpenAI互換APIを利用しつつ、ひろゆき風のプロンプトで採点します。
class HiroyukiFallbackAdapter < BaseOpenAiCompatAdapter
  PROMPT_PATH = 'app/prompts/hiroyuki.txt'
  BASE_URL = 'https://api.groq.com/openai/v1'
  MODEL_NAME = 'llama-3.3-70b-versatile'

  private

  def api_base_url
    BASE_URL
  end

  def model_name
    MODEL_NAME
  end

  def api_key
    if ENV.fetch('SECRETS_MANAGER_ENABLED', 'false') == 'true'
      return SecretsManagerClient.get_api_key(
        secret_arn: ENV.fetch('GROQ_SECRET_ARN', nil),
        env_key: 'GROQ_API_KEY'
      )
    end

    key = ENV.fetch('GROQ_API_KEY', nil)
    raise ArgumentError, 'GROQ_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  def retryable_result_max_retries
    return 0 if sync_rejudge_context?

    super
  end
end
