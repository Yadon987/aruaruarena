# frozen_string_literal: true

# ペルソナ別のコメント文体補正を担当するサービス
class PersonaCommentStyleService
  MAX_COMMENT_LENGTH = 30
  GRAPHEME_CLUSTER_PATTERN = /\X/

  COMMENT_KEYWORD_REPLACEMENTS = {
    'hiroyuki' => {
      /共感度?/ => '再現性',
      /刺さる/ => '論点が通る',
      /あるある感/ => '解像度'
    }.freeze,
    'dewi' => {
      /共感度?/ => '品格',
      /刺さる/ => '華が立つ',
      /あるある感/ => '気品'
    }.freeze,
    'nakao' => {
      /共感度?/ => '余韻',
      /刺さる/ => '味が残る',
      /あるある感/ => '匂い立つ情景'
    }.freeze
  }.freeze

  COMMENT_LINE_REPLACEMENTS = {
    'hiroyuki' => {
      /共感(?:が|は)?強い(?:です)?/ => '再現性は高いって話です',
      /共感(?:が|は)?弱い(?:です)?/ => '再現性は低いですよね',
      /共感(?:が|は)?ある(?:です)?/ => '論点はズレてないって話です'
    }.freeze,
    'dewi' => {
      /共感(?:が|は)?強い(?:です)?/ => '気品のある着地ですわ',
      /共感(?:が|は)?弱い(?:です)?/ => '華が足りませんの',
      /共感(?:が|は)?ある(?:です)?/ => '気品が通っていますわ'
    }.freeze,
    'nakao' => {
      /共感(?:が|は)?強い(?:です)?/ => '余韻が深いかな',
      /共感(?:が|は)?弱い(?:です)?/ => '少し薄味だね',
      /共感(?:が|は)?ある(?:です)?/ => '味が残るかな',
      /共感(?:が|は)?残る(?:です)?/ => '余韻が残るかな'
    }.freeze
  }.freeze

  COMMENT_ENDINGS = {
    'hiroyuki' => {
      suffix: 'って話です',
      allowed: [
        /ですよね\z/,
        /よね\z/,
        /じゃないですか\z/,
        /って話です\z/,
        /なんですよね\z/,
        /だと思いますよ\z/,
        /ってところです\z/
      ].freeze
    }.freeze,
    'dewi' => {
      suffix: 'ですわ',
      allowed: [
        /ですわ\z/,
        /ですこと\z/,
        /ですの\z/,
        /よろしくてよ\z/,
        /ですわね\z/,
        /ますわ\z/,
        /ませんわ\z/,
        /ございませんわ\z/,
        /ありませんこと\z/
      ].freeze
    }.freeze,
    'nakao' => {
      suffix: 'だね',
      allowed: [
        /だね\z/,
        /だな\z/,
        /だよ\z/,
        /かな\z/,
        /じゃないか\z/,
        /だろうね\z/,
        /かもしれないね\z/,
        /ね\z/
      ].freeze
    }.freeze
  }.freeze

  class << self
    # @param comment [String]
    # @param persona [String]
    # @return [String]
    def style(comment, persona)
      normalized_comment = normalize_comment(comment)
      return normalized_comment if normalized_comment.blank?

      replaced_comment = apply_full_line_replacement(normalized_comment, persona)
      return truncate_comment(replaced_comment) if replaced_comment

      replacements = COMMENT_KEYWORD_REPLACEMENTS.fetch(persona) do
        raise ArgumentError, "Unsupported persona: #{persona}"
      end
      styled_comment = apply_keyword_replacements(normalized_comment, replacements)

      truncate_comment(apply_comment_ending(styled_comment, persona))
    end

    private

    def normalize_comment(comment)
      comment.to_s.strip.gsub(/\s+/, '')
    end

    def apply_full_line_replacement(comment, persona)
      replacements = COMMENT_LINE_REPLACEMENTS.fetch(persona) do
        raise ArgumentError, "Unsupported persona: #{persona}"
      end

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
      ending_rule = COMMENT_ENDINGS.fetch(persona) do
        raise ArgumentError, "Unsupported persona: #{persona}"
      end
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
        comment
          .sub(/ません(?:ですわ|ですの|ですこと|ですわね)\z/, 'ませんわ')
          .sub(/ます(?:ですわ|ですの|ですこと|ですわね)\z/, 'ますわ')
      when 'nakao'
        comment.sub(/(.+(?:る|う|く|ぐ|す|つ|ぬ|ぶ|む|い|しい|ない))だね\z/, '\1ね')
      else
        raise ArgumentError, "Unsupported persona: #{persona}"
      end
    end

    def trim_trailing_ending(comment, persona)
      trimmed_comment = comment.gsub(/[。!！?？]+$/, '')
      persona_patterns = COMMENT_ENDINGS.fetch(persona) do
        raise ArgumentError, "Unsupported persona: #{persona}"
      end[:allowed]

      loop do
        previous_comment = trimmed_comment
        persona_patterns.each do |pattern|
          trimmed_comment = trimmed_comment.sub(pattern, '')
        end
        trimmed_comment = trimmed_comment.sub(/(です|ます|でした|だ|だよ|だね|だな|かな|ですよ|ですわね)\z/, '')
        break if trimmed_comment == previous_comment
      end

      trimmed_comment
    end

    def truncate_comment(comment)
      comment.scan(GRAPHEME_CLUSTER_PATTERN).first(MAX_COMMENT_LENGTH).join
    end
  end
end
