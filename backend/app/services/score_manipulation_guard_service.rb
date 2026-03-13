# frozen_string_literal: true

# 採点誘導文の検知と合計点上限を担当するサービス
class ScoreManipulationGuardService
  MAX_TOTAL_SCORE_WHEN_MANIPULATED = 60

  DIRECTIVE_PATTERNS = [
    /system\s*prompt/i,
    /プロンプト/,
    /previous instructions/i,
    /ignore .*instructions/i,
    /指示を無視/,
    /審査基準を無視/,
    /この指示に従って/,
    /この命令に従って/,
    /採点してください/,
    /評価してください/,
    /高く評価/,
    /高評価/,
    /高得点/,
    /満点/,
    /優勝/,
    /ランキング上位/,
    /一位/,
    /1位/,
    /トップに/,
    /低評価はなし/,
    /減点しない/,
    /甘めに採点/,
    /贔屓/,
    /厳守/,
    /必ず.*(?:点|評価)/,
    /審査員.*(?:お願い|して|指示|採点|評価)/
  ].freeze

  SCORE_REFERENCE_PATTERN = /(?:\d{1,3}|百)\s*点(?:以上|以下|台|満点|を|くらい|ぐらい)?/
  INSTRUCTION_PATTERN = /(?:お願い|お願いします|厳守|採点|評価|指示|命令|従って|して|しろ|せよ|無視|入れて|上げて|上がるように|してください)/

  class << self
    def score_manipulation?(body)
      normalized_body = normalize(body)
      return false if normalized_body.blank?

      direct_match?(normalized_body) || score_reference_with_instruction?(normalized_body)
    end

    def cap_total_score(body, total_score)
      return total_score unless score_manipulation?(body)

      [total_score, MAX_TOTAL_SCORE_WHEN_MANIPULATED].min
    end

    private

    def normalize(body)
      body.to_s.unicode_normalize(:nfkc)
    end

    def direct_match?(body)
      DIRECTIVE_PATTERNS.any? { |pattern| body.match?(pattern) }
    end

    def score_reference_with_instruction?(body)
      body.match?(SCORE_REFERENCE_PATTERN) && body.match?(INSTRUCTION_PATTERN)
    end
  end
end
