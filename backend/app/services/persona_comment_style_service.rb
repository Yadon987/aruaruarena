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
      allowed: %w[ですよね じゃないですか って話です]
    }.freeze,
    'dewi' => {
      suffix: 'ですわ',
      allowed: %w[ですわ ですこと ですの よろしくてよ]
    }.freeze,
    'nakao' => {
      suffix: 'だね',
      allowed: %w[だね だな だよ かな]
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
      return comment if ending_rule[:allowed].any? { |suffix| comment.end_with?(suffix) }

      "#{trim_trailing_ending(comment)}#{ending_rule[:suffix]}"
    end

    def trim_trailing_ending(comment)
      comment.gsub(/[。!！?？]+$/, '').sub(/(です|ます|でした|だ|だよ|だね|だな|かな)\z/, '')
    end

    def truncate_comment(comment)
      comment.scan(GRAPHEME_CLUSTER_PATTERN).first(MAX_COMMENT_LENGTH).join
    end
  end
end
