# frozen_string_literal: true

# GlmAdapter - ZhipuAI GLM-4-Flash API用アダプター
#
# BaseGlmAdapterを継承し、ひろゆき風の審査員として投稿を採点します。
#
# @see https://open.bigmodel.cn/dev/api#glm-4
class GlmAdapter < BaseGlmAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/hiroyuki.txt'
end
