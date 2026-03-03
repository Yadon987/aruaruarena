# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe 'SecretsManagerClient', dynamodb: false do
  include AdapterTestHelpers

  let(:client_class) { Object.const_get('SecretsManagerClient') }
  let(:valid_arn) do
    'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:aruaruarena/ai-keys/gemini-abc123'
  end
  let(:invalid_arn) { 'invalid-arn' }
  let(:env_key) { 'GEMINI_API_KEY' }
  let(:valid_api_key) { 'test-api-key-12345' }

  describe '.get_api_key' do
    # 何を検証するか: 有効なARNからAPIキーを取得できること
    it '有効なARNからAPIキーを取得できること' do
      stub_secrets_manager_env(
        enabled: 'true',
        secret_env_key: 'GEMINI_SECRET_ARN',
        secret_arn: valid_arn,
        legacy_env_key: env_key,
        legacy_api_key: nil
      )
      stub_secrets_manager_success(arn: valid_arn, api_key: valid_api_key)

      expect(client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)).to eq(valid_api_key)
    end

    # 何を検証するか: 2回目の呼び出しはキャッシュから返ること
    it '2回目の呼び出しがキャッシュから返ること' do
      stub_secrets_manager_success(arn: valid_arn, api_key: valid_api_key)

      client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)
      client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)

      expect(a_request(:post, 'https://secretsmanager.ap-northeast-1.amazonaws.com/')).to have_been_made.once
    end

    # 何を検証するか: ローカル開発では環境変数フォールバックが使われること
    it 'SECRETS_MANAGER_ENABLED=false時は環境変数を使用すること' do
      stub_secrets_manager_env(
        enabled: 'false',
        secret_env_key: 'GEMINI_SECRET_ARN',
        secret_arn: valid_arn,
        legacy_env_key: env_key,
        legacy_api_key: valid_api_key
      )

      expect(client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)).to eq(valid_api_key)
    end

    # 何を検証するか: clear_cache!後はローテーション後の新しい値を取り直すこと
    it 'clear_cache!後に新しいAPIキーを再取得できること' do
      stub_secrets_manager_rotation(arn: valid_arn, old_api_key: 'old-key', new_api_key: 'new-key')

      expect(client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)).to eq('old-key')

      client_class.clear_cache!

      expect(client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)).to eq('new-key')
    end

    # 何を検証するか: 無効なARNは入力時点で弾かれること
    it '無効なARNの場合はArgumentErrorを発生させること' do
      expect do
        client_class.get_api_key(secret_arn: invalid_arn, env_key: env_key)
      end.to raise_error(ArgumentError, /ARN/)
    end

    # 何を検証するか: シークレット不存在時は取得失敗として扱うこと
    it 'シークレットが存在しない場合はArgumentErrorを発生させること' do
      stub_secrets_manager_error(arn: valid_arn, error_type: :not_found)

      expect do
        client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)
      end.to raise_error(ArgumentError, /シークレットが見つかりません/)
    end

    # 何を検証するか: 権限不足時は専用エラーとして扱うこと
    it '権限エラー時はArgumentErrorを発生させること' do
      stub_secrets_manager_error(arn: valid_arn, error_type: :access_denied)

      expect do
        client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)
      end.to raise_error(ArgumentError, /アクセス権限がありません/)
    end

    # 何を検証するか: 不正JSONはパースエラーとして扱うこと
    it '不正なJSON文字列の場合はArgumentErrorを発生させること' do
      stub_secrets_manager_error(arn: valid_arn, error_type: :parse_error)

      expect do
        client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)
      end.to raise_error(ArgumentError, /secrets_parse_error/)
    end

    # 何を検証するか: 一時障害時は3回リトライ後に失敗すること
    it 'ネットワークエラー時に3回リトライしてからエラーを発生させること' do
      stub_secrets_manager_error(arn: valid_arn, error_type: :service_error)

      expect do
        client_class.get_api_key(secret_arn: valid_arn, env_key: env_key)
      end.to raise_error(ArgumentError, /secrets_fetch_failed/)

      expect(a_request(:post, 'https://secretsmanager.ap-northeast-1.amazonaws.com/')).to have_been_made.times(4)
    end
  end

  describe '.valid_arn?' do
    # 何を検証するか: ap-northeast-1のSecrets Manager ARNだけを許可すること
    it 'Secrets Manager用のARN形式を検証できること' do
      expect(client_class.valid_arn?(valid_arn)).to be(true)
      expect(client_class.valid_arn?(invalid_arn)).to be(false)
    end
  end
end
