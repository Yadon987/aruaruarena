# frozen_string_literal: true

RSpec.shared_examples 'secrets manager api key resolution' do |secret_env_key:, legacy_env_key:|
  let(:secret_arn) do
    "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:aruaruarena/ai-keys/#{legacy_env_key.downcase}-abc123"
  end
  let(:secrets_manager_api_key) { "secrets-manager-#{legacy_env_key.downcase}" }

  describe '#api_key' do
    context 'SECRETS_MANAGER_ENABLED=true のとき' do
      # 何を検証するか: Secrets ManagerからAPIキーを取得すること
      it 'SecretsManagerClient経由でAPIキーを取得すること' do
        secrets_manager_client = class_double('SecretsManagerClient').as_stubbed_const

        stub_secrets_manager_env(
          enabled: 'true',
          secret_env_key: secret_env_key,
          secret_arn: secret_arn,
          legacy_env_key: legacy_env_key,
          legacy_api_key: 'legacy-env-key'
        )
        allow(secrets_manager_client).to receive(:get_api_key)
          .with(secret_arn: secret_arn, env_key: legacy_env_key)
          .and_return(secrets_manager_api_key)

        expect(adapter.send(:api_key)).to eq(secrets_manager_api_key)
        expect(secrets_manager_client).to have_received(:get_api_key).once
      end

      # 何を検証するか: 旧環境変数よりSecrets Managerの値を優先すること
      it '旧環境変数が存在してもSecrets Managerの値を優先すること' do
        secrets_manager_client = class_double('SecretsManagerClient').as_stubbed_const

        stub_secrets_manager_env(
          enabled: 'true',
          secret_env_key: secret_env_key,
          secret_arn: secret_arn,
          legacy_env_key: legacy_env_key,
          legacy_api_key: 'legacy-env-key'
        )
        allow(secrets_manager_client).to receive(:get_api_key).and_return(secrets_manager_api_key)

        expect(adapter.send(:api_key)).not_to eq('legacy-env-key')
      end

      # 何を検証するか: シークレット取得失敗時にエラーをそのまま返すこと
      it 'シークレット取得失敗時に取得エラーを返すこと' do
        secrets_manager_client = class_double('SecretsManagerClient').as_stubbed_const

        stub_secrets_manager_env(
          enabled: 'true',
          secret_env_key: secret_env_key,
          secret_arn: secret_arn,
          legacy_env_key: legacy_env_key,
          legacy_api_key: nil
        )
        allow(secrets_manager_client).to receive(:get_api_key)
          .with(secret_arn: secret_arn, env_key: legacy_env_key)
          .and_raise(ArgumentError, 'secrets_fetch_failed')

        expect { adapter.send(:api_key) }.to raise_error(ArgumentError, /secrets_fetch_failed/)
      end
    end
  end
end
