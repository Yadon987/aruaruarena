# frozen_string_literal: true

# Adapterテスト用の共通ヘルパー
#
# @note このモジュールは spec/support/ に配置され、rails_helper.rb で自動的に読み込まれます
module AdapterTestHelpers
  # テストで共通利用する標準スコア
  #
  # @return [Hash]
  def default_scores
    {
      empathy: 15,
      humor: 15,
      brevity: 15,
      originality: 15,
      expression: 15
    }
  end

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
        scores: default_scores,
        comment: 'テストコメント'
      ) : create_timeout_response
    )
  end

  # 主要アダプターをすべて成功モックにする
  #
  # @param scores [Hash] 返却するスコア
  # @return [void]
  def mock_all_adapters_success(scores: default_scores)
    [GeminiAdapter, OpenAiAdapter, DewiAdapter, CerebrasAdapter].each do |adapter_class|
      allow_any_instance_of(adapter_class).to receive(:judge).and_return(
        create_success_response(scores: scores, comment: "#{adapter_class} comment")
      )
    end
  end

  # 特定アダプターのみ失敗モックにする
  #
  # @param adapter_class [Class] 対象アダプター
  # @param error_code [String] エラーコード
  # @return [void]
  def mock_adapter_failure(adapter_class, error_code: 'timeout')
    response = if error_code == 'timeout'
                 create_timeout_response
               else
                 create_api_error_response(error_code: error_code)
               end

    allow_any_instance_of(adapter_class).to receive(:judge).and_return(response)
  end

  # adapter_classを文字列キーとして使用してモックを取得する
  def get_adapter_mock(adapter_class)
    adapter_name = adapter_class.to_s.split('::').last.downcase
    @adapter_mocks&.dig(adapter_name.to_sym)
  end

  # adapter_classを文字列キーとして使用してモックを設定する
  def set_adapter_mock(adapter_class, mock)
    adapter_name = adapter_class.to_s.split('::').last.downcase
    @adapter_mocks ||= {}
    @adapter_mocks[adapter_name.to_sym] = mock
  end

  # Secrets Manager統合テスト向けの環境変数をモックする
  #
  # @param enabled [String] 機能フラグ
  # @param secret_env_key [String] ARNを保持する環境変数名
  # @param secret_arn [String, nil] Secrets ManagerのARN
  # @param legacy_env_key [String] 従来のAPIキー環境変数名
  # @param legacy_api_key [String, nil] 従来のAPIキー
  # @return [void]
  def stub_secrets_manager_env(enabled:, secret_env_key:, secret_arn:, legacy_env_key:, legacy_api_key: nil)
    stub_env('SECRETS_MANAGER_ENABLED', enabled)
    stub_env(secret_env_key, secret_arn)
    stub_env(legacy_env_key, legacy_api_key)
  end

  # Secrets Manager APIレスポンスをモックする
  #
  # @param body [Hash, String] レスポンスボディ
  # @param status [Integer] HTTPステータス
  # @return [WebMock::RequestStub]
  def stub_secrets_manager_response(body:, status: 200)
    payload = body.is_a?(String) ? body : JSON.generate(body)

    stub_request(:post, 'https://secretsmanager.ap-northeast-1.amazonaws.com/')
      .to_return(
        status: status,
        body: payload,
        headers: { 'Content-Type' => 'application/x-amz-json-1.1' }
      )
  end

  # Secrets Managerの成功レスポンスをモックする
  #
  # @param arn [String] シークレットARN
  # @param api_key [String] APIキー
  # @return [WebMock::RequestStub]
  def stub_secrets_manager_success(arn:, api_key:)
    stub_secrets_manager_response(
      body: {
        ARN: arn,
        SecretString: { api_key: api_key }.to_json
      }
    )
  end

  # Secrets Managerのエラーレスポンスをモックする
  #
  # @param arn [String] シークレットARN
  # @param error_type [Symbol] エラー種別
  # @return [WebMock::RequestStub]
  def stub_secrets_manager_error(arn:, error_type:)
    error_body = case error_type
                 when :not_found
                   { '__type' => 'ResourceNotFoundException', 'message' => "#{arn} は存在しません" }
                 when :access_denied
                   { '__type' => 'AccessDeniedException', 'message' => "#{arn} へのアクセスが拒否されました" }
                 when :parse_error
                   { ARN: arn, SecretString: '{invalid-json' }
                 else
                   { '__type' => 'ServiceUnavailableException', 'message' => "#{arn} の取得に失敗しました" }
                 end

    status = error_type == :parse_error ? 200 : 400
    stub_secrets_manager_response(body: error_body, status: status)
  end

  # Secrets Managerのローテーションをモックする
  #
  # @param arn [String] シークレットARN
  # @param old_api_key [String] 旧APIキー
  # @param new_api_key [String] 新APIキー
  # @return [WebMock::RequestStub]
  def stub_secrets_manager_rotation(arn:, old_api_key:, new_api_key:)
    stub_request(:post, 'https://secretsmanager.ap-northeast-1.amazonaws.com/')
      .to_return(
        {
          status: 200,
          body: JSON.generate({ ARN: arn, SecretString: { api_key: old_api_key }.to_json }),
          headers: { 'Content-Type' => 'application/x-amz-json-1.1' }
        },
        {
          status: 200,
          body: JSON.generate({ ARN: arn, SecretString: { api_key: new_api_key }.to_json }),
          headers: { 'Content-Type' => 'application/x-amz-json-1.1' }
        }
      )
  end
end

RSpec.configure do |config|
  config.include AdapterTestHelpers, type: :model
  config.include AdapterTestHelpers, type: :adapter
end
