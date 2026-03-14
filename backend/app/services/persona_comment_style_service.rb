# frozen_string_literal: true

# ペルソナ別のコメント文体補正を担当するサービス
class PersonaCommentStyleService
  MAX_COMMENT_LENGTH = 30
  GRAPHEME_CLUSTER_PATTERN = /\X/

  class << self
    # @param comment [String]
    # @param persona [String]
    # @return [String]
    def style(comment, persona)
      normalized_comment = normalize_comment(comment)
      return normalized_comment if normalized_comment.blank?

      replaced_comment = apply_full_line_replacement(normalized_comment, persona)
      return truncate_comment(replaced_comment) if replaced_comment

      replacements = fetch_rule(PersonaCommentStyleRules::COMMENT_KEYWORD_REPLACEMENTS, persona)
      styled_comment = apply_keyword_replacements(normalized_comment, replacements)

      truncate_comment(apply_comment_ending(styled_comment, persona))
    end

    private

    def normalize_comment(comment)
      comment.to_s.strip.gsub(/\s+/, '')
    end

    def apply_full_line_replacement(comment, persona)
      replacements = fetch_rule(PersonaCommentStyleRules::COMMENT_LINE_REPLACEMENTS, persona)

      replacements.each do |pattern, replacement|
        return replacement if comment.match?(pattern)
      end

      nil
    end

    def apply_keyword_replacements(comment, replacements)
      replacements.reduce(comment) do |memo, (pattern, replacement)|
        memo.gsub(pattern, replacement)
      end
    end

    def apply_comment_ending(comment, persona)
      ending_rule = fetch_rule(PersonaCommentStyleRules::COMMENT_ENDINGS, persona)
      normalized_comment = normalize_persona_ending(comment, persona)
      deduplicated_comment = remove_duplicate_suffix(normalized_comment, ending_rule)
      return deduplicated_comment if allowed_comment_ending?(deduplicated_comment, ending_rule)
      return normalized_comment if allowed_comment_ending?(normalized_comment, ending_rule)

      "#{trim_trailing_ending(normalized_comment, persona)}#{ending_rule[:suffix]}"
    end

    def allowed_comment_ending?(comment, ending_rule)
      ending_rule[:allowed].any? { |pattern| comment.match?(pattern) }
    end

    def remove_duplicate_suffix(comment, ending_rule)
      return comment unless comment.end_with?(ending_rule[:suffix])

      base_comment = comment.delete_suffix(ending_rule[:suffix])
      return base_comment if allowed_comment_ending?(base_comment, ending_rule)

      comment
    end

    def normalize_persona_ending(comment, persona)
      case persona
      when 'hiroyuki'
        comment
      when 'dewi'
        normalize_dewi_ending(comment)
      when 'nakao'
        normalize_nakao_ending(comment)
      else
        raise ArgumentError, "Unsupported persona: #{persona}"
      end
    end

    def trim_trailing_ending(comment, persona)
      trimmed_comment = comment.gsub(/[。!！?？]+$/, '')
      persona_patterns = fetch_rule(PersonaCommentStyleRules::COMMENT_ENDINGS, persona)[:allowed]

      loop do
        previous_comment = trimmed_comment
        trimmed_comment = remove_known_endings(trimmed_comment, persona_patterns)
        break if trimmed_comment == previous_comment
      end

      trimmed_comment
    end

    def fetch_rule(rule_set, persona)
      rule_set.fetch(persona) do
        raise ArgumentError, "Unsupported persona: #{persona}"
      end
    end

    def normalize_dewi_ending(comment)
      comment
        .sub(/ません(?:ですわ|ですの|ですこと|ですわね)\z/, 'ませんわ')
        .sub(/ます(?:ですわ|ですの|ですこと|ですわね)\z/, 'ますわ')
    end

    def normalize_nakao_ending(comment)
      comment.sub(/(.+(?:る|う|く|ぐ|す|つ|ぬ|ぶ|む|い|しい|ない))だね\z/, '\1ね')
    end

    def remove_known_endings(comment, persona_patterns)
      trimmed_comment = comment
      persona_patterns.each do |pattern|
        trimmed_comment = trimmed_comment.sub(pattern, '')
      end
      trimmed_comment.sub(/(です|ます|でした|だ|だよ|だね|だな|かな|ですよ|ですわね)\z/, '')
    end

    def truncate_comment(comment)
      comment.scan(GRAPHEME_CLUSTER_PATTERN).first(MAX_COMMENT_LENGTH).join
    end
  end
end
