# frozen_string_literal: true

# ペルソナ別の採点補正を担当するサービス
class PersonaBiasService
  MAX_SCORE_PER_ITEM = 20

  class << self
    # @param base_scores [Hash]
    # @param persona [String]
    # @return [Hash]
    def apply_persona_bias(base_scores, persona)
      scores = base_scores.dup
      apply_bias_by_persona(scores, persona)
      scores
    end

    # @param scores [Hash]
    # @param persona [String]
    # @return [void]
    def apply_bias_by_persona(scores, persona)
      case persona
      when 'hiroyuki' then apply_hiroyuki_bias(scores)
      when 'dewi'     then apply_dewi_bias(scores)
      when 'nakao'    then apply_nakao_bias(scores)
      else
        raise ArgumentError, "Unsupported persona: #{persona}"
      end
    end

    # @param scores [Hash]
    # @return [void]
    def apply_hiroyuki_bias(scores)
      scores[:originality] = [scores[:originality] + 3, MAX_SCORE_PER_ITEM].min
      scores[:empathy] = [scores[:empathy] - 2, 0].max
    end

    # @param scores [Hash]
    # @return [void]
    def apply_dewi_bias(scores)
      scores[:expression] = [scores[:expression] + 3, MAX_SCORE_PER_ITEM].min
      scores[:humor] = [scores[:humor] + 2, MAX_SCORE_PER_ITEM].min
    end

    # @param scores [Hash]
    # @return [void]
    def apply_nakao_bias(scores)
      scores[:humor] = [scores[:humor] + 3, MAX_SCORE_PER_ITEM].min
      scores[:empathy] = [scores[:empathy] + 2, MAX_SCORE_PER_ITEM].min
    end

    # @param scores [Hash]
    # @return [Integer]
    def calculate_total_score(scores)
      scores.values.sum
    end
  end
end
