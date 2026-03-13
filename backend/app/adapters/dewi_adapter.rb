# frozen_string_literal: true

# DewiAdapter - Cerebras API用アダプター
#
# BaseOpenAiCompatAdapterを継承し、デヴィ婦人風の審査員として投稿を採点します。
# OpenAI互換エンドポイントとしてCerebrasを使用します。
#
# @see https://inference-docs.cerebras.ai/
class DewiAdapter < BaseOpenAiCompatAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/dewi.txt'

  # Cerebras APIのベースURL
  BASE_URL = 'https://api.cerebras.ai/v1'

  # Cerebrasで現在利用可能なモデル
  MODEL_NAME = 'llama3.1-8b'

  private

  def api_base_url
    BASE_URL
  end

  def api_endpoint
    'chat/completions'
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
