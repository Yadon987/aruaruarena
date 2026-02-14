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
    allow(ENV).to receive(:fetch).with(key, anything).and_return(value)
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

  # Faraday::Responseライクなモックを作成する共通ヘルパー
  #
  # @param body_hash [Hash] レスポンスボディのハッシュ
  # @return [Double] bodyメソッドを持つモックオブジェクト（JSON文字列化されたbody）
  def build_faraday_response(body_hash)
    double('Faraday::Response', body: JSON.generate(body_hash))
  end

  # HTTPステータスコード付きのレスポンスモックを作成する共通ヘルパー
  #
  # @param status [Integer] HTTPステータスコード
  # @param body [Hash] レスポンスボディ（デフォルトは空ハッシュ）
  # @return [Double] statusとbodyメソッドを持つモックオブジェクト
  def build_http_response(status, body = {})
    double('Faraday::Response', status: status, body: body)
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

  # adapter_classを文字列キーとして使用してモックを取得する
  def get_adapter_mock(adapter_class)
    adapter_name = adapter_class.to_s.split('::').last.downcase
    instance_variable_get(:@adapter_mocks, nil)&.dig(adapter_name.to_sym)
  end

  # adapter_classを文字列キーとして使用してモックを設定する
  def set_adapter_mock(adapter_class, mock)
    adapter_name = adapter_class.to_s.split('::').last.downcase
    mocks = instance_variable_get(:@adapter_mocks, nil) || {}
    instance_variable_set(:@adapter_mocks, mocks.merge(adapter_name.to_sym => mock))
  end
end

RSpec.configure do |config|
  config.include AdapterTestHelpers, type: :model
  config.include AdapterTestHelpers, type: :adapter
end
