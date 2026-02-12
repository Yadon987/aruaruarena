# frozen_string_literal: true

# Adapterテスト用の共通ヘルパー
#
# @note このモジュールは spec/support/ に配置され、rails_helper.rb で自動的に読み込まれます
module AdapterTestHelpers
  # 環境変数をモックするヘルパーメソッド
  #
  # @param key [String] 環境変数名
  # @param value [String, nil] 環境変数の値
  # @return [void]
  #
  # @example
  #   stub_env('OPENAI_API_KEY', 'test_key')
  #   stub_env('GLM_API_KEY', nil)
  def stub_env(key, value)
    allow(ENV).to receive(:[]).with(key).and_return(value)
  end

  # 共通の成功レスポンスモック
  #
  # @param scores [Hash] スコアハッシュ
  # @param comment [String] コメント
  # @return [BaseAiAdapter::JudgmentResult] 成功レスポンス
  def create_success_response(scores:, comment:)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: scores,
      comment: comment
    )
  end

  # 共通のタイムアウトレスポンスモック
  #
  # @return [BaseAiAdapter::JudgmentResult] タイムアウトレスポンス
  def create_timeout_response
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: 'timeout',
      scores: nil,
      comment: nil
    )
  end

  # 共通のAPIエラーレスポンスモック
  #
  # @param error_code [String] エラーコード
  # @return [BaseAiAdapter::JudgmentResult] APIエラーレスポンス
  def create_api_error_response(error_code:)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: error_code,
      scores: nil,
      comment: nil
    )
  end

  # Adapterをモックするヘルパー
  #
  # @param adapter_class [Class] Adapterクラス
  # @param success [Boolean] 成功するかどうか（デフォルトtrue）
  # @return [void]
  #
  # @example
  #   mock_adapter_judge(GeminiAdapter, success: true)
  #   mock_adapter_judge(DewiAdapter, success: false)
  def mock_adapter_judge(adapter_class, success: true)
    allow_any_instance_of(adapter_class).to receive(:judge).and_return(
      success ? create_success_response(
        scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
        comment: 'テストコメント'
      ) : create_timeout_response
    )
  end
end

RSpec.configure do |config|
  config.include AdapterTestHelpers, type: :model
end
