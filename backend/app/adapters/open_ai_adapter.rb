# frozen_string_literal: true

# OpenAiAdapter - OpenAI GPT-4o-mini API用アダプター
#
# BaseOpenAiCompatAdapterを継承し、中尾彬風の審査員として投稿を採点します。
#
# @see https://platform.openai.com/docs/api-reference/chat
class OpenAiAdapter < BaseOpenAiCompatAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/nakao.txt'

  # OpenAI APIのベースURL
  BASE_URL = 'https://api.openai.com'

  # GPT-4o-miniモデル
  MODEL_NAME = 'gpt-4o-mini'

  private

  def api_base_url
    BASE_URL
  end

  def api_endpoint
    'v1/chat/completions'
  end

  def model_name
    MODEL_NAME
  end

  def api_key
    key = ENV.fetch('OPENAI_API_KEY', nil)
    raise ArgumentError, 'OPENAI_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end
end
