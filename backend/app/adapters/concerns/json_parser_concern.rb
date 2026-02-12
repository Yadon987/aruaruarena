# frozen_string_literal: true

# JsonParserConcern - AI Adapter共通のJSONパース処理
#
# 複数のAI Adapter（Gemini, GLM, OpenAI）で共通する
# JSONパース処理をモジュールとして抽出しました。
module JsonParserConcern
  # コードブロックからJSONを抽出する
  #
  # @param text [String] AIからのレスポンステキスト
  # @return [String] 抽出されたJSON文字列
  def extract_json_from_codeblock(text)
    if text.include?('```')
      if text.match?(/```json/)
        extracted = text.slice(/```json\s*\n(.*?)\n?```/m, 1)
        return extracted.strip if extracted
      end

      extracted = text.slice(/```\s*\n(.*?)\n?```/m, 1)
      return extracted.strip if extracted
    end
    text
  end

  # スコアを整数に変換する
  #
  # @param data [Hash] AIからのスコアデータ
  # @return [Hash] 整数に変換されたスコアハッシュ
  # @raise [ArgumentError] スコア値が無効な場合
  def convert_scores_to_integers(data)
    scores = {}
    BaseAiAdapter::REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]
      raise ArgumentError, "Score value is nil for #{key}" if value.nil?

      begin
        integer_value = if value.is_a?(Integer)
                        value
                      else
                        Float(value).round
                      end
      rescue ArgumentError, FloatDomainError, RangeError, TypeError => e # rubocop:disable Lint/ShadowedException
        raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}", cause: e
      end # rubocop:enable Lint/ShadowedException
      scores[key] = integer_value
    end
    scores
  end

  # コメントを切り詰める
  #
  # @param comment [String, nil] コメント文字列
  # @param max_length [Integer] 最大長（デフォルト30文字）
  # @return [String, nil] 切り詰められたコメント
  def truncate_comment(comment, max_length: 30)
    return nil if comment.nil?

    comment.to_s.strip[0...max_length]
  end
end
