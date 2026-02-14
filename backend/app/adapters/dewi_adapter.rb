# frozen_string_literal: true

# DewiAdapter - ZhipuAI GLM-4-Flash API用アダプター
#
# BaseGlmAdapterを継承し、デヴィ婦人風の審査員として投稿を採点します。
#
# @see https://open.bigmodel.cn/dev/api#glm-4
class DewiAdapter < BaseGlmAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/dewi.txt'
end
