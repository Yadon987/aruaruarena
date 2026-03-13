# frozen_string_literal: true

# CerebrasAdapter - Cerebras (llama3.1-8b) 用アダプター
#
# BaseOpenAiCompatAdapterを継承し、デヴィ夫人風の審査員として投稿を採点します。
#
# @see https://cerebras.ai/
class CerebrasAdapter < BaseOpenAiCompatAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/dewi.txt'

  # Cerebras APIのベースURL
  BASE_URL = 'https://api.cerebras.ai/v1'

  # llama3.1-8bモデル
  MODEL_NAME = 'llama3.1-8b'

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
        secret_arn: ENV.fetch('CEREBRAS_SECRET_ARN', nil),
        env_key: 'CEREBRAS_API_KEY'
      )
    end

    key = ENV.fetch('CEREBRAS_API_KEY', nil)
    raise ArgumentError, 'CEREBRAS_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end
end
