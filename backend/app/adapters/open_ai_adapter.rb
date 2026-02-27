# frozen_string_literal: true

# OpenAiAdapter - Groq OpenAI互換API用アダプター
#
# BaseOpenAiCompatAdapterを継承し、中尾彬風の審査員として投稿を採点します。
# OpenAI互換エンドポイントとしてGroqを使用します。
#
# @see https://console.groq.com/docs/openai
class OpenAiAdapter < BaseOpenAiCompatAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/nakao.txt'

  # Groq OpenAI互換APIのベースURL
  BASE_URL = 'https://api.groq.com/openai/v1'

  # Llama 3.3 70Bモデル
  MODEL_NAME = 'llama-3.3-70b-versatile'

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
    key = ENV.fetch('GROQ_API_KEY', nil)
    raise ArgumentError, 'GROQ_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end
end
