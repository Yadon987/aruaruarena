# frozen_string_literal: true

# CerebrasAdapter - Cerebras (gpt-oss-120b) 用アダプター
#
# BaseOpenAiCompatAdapterを継承し、デヴィ夫人風の審査員として投稿を採点します。
#
# @see https://cerebras.ai/
class CerebrasAdapter < BaseOpenAiCompatAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/dewi.txt'

  # Cerebras APIのベースURL
  BASE_URL = 'https://api.cerebras.ai/v1'

  # gpt-oss-120bモデル
  MODEL_NAME = 'gpt-oss-120b'

  private

  def api_base_url
    BASE_URL
  end

  def model_name
    MODEL_NAME
  end

  def api_key
    key = ENV['CEREBRAS_API_KEY']
    raise ArgumentError, 'CEREBRAS_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end
end
