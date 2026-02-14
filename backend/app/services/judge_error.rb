# frozen_string_literal: true

# JudgeError - 審査処理用のカスタム例外クラス
#
# 審査処理で発生した例外を標準化し、
# エラーハンドリングの一貫性を確保します。
class JudgeError < StandardError
  # エラーコード
  #
  # @return [String] エラーコード
  attr_reader :error_code

  # 審査員ID
  #
  # @return [String, nil] 審査員ID（ひろゆき/デヴィ/中尾）
  attr_reader :persona

  # 元の例外
  #
  # @return [StandardError, nil] 元の例外
  attr_reader :original_error

  # 初期化
  #
  # @param persona [String] 審査員ID
  # @param error_code [String] エラーコード
  # @param original_error [StandardError, nil] 元の例外
  def initialize(judge_persona:, error_code:, original_error: nil)
    @persona = judge_persona
    @error_code = error_code
    @original_error = original_error
    super("[JudgeError] persona=#{judge_persona}, error_code=#{error_code}")
  end

  # ハッシュ形式に変換する（ログ出力用）
  #
  # @return [Hash] エラー情報ハッシュ
  def to_h
    {
      persona: @persona,
      error_code: @error_code,
      message: @original_error ? "#{@original_error.class}: 審査エラーが発生しました" : '審査エラーが発生しました'
    }
  end
end
