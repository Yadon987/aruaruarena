# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AiSecretHealthCheckService, type: :service do
  describe '.missing_env_vars' do
    let(:base_required_env_vars) { %w[GEMINI_API_KEY APP_NAME] }

    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:fetch).and_call_original
    end

    it 'Secrets Manager無効時は未設定の環境変数を返すこと' do
      allow(ENV).to receive(:fetch).with('GEMINI_API_KEY', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('APP_NAME', nil).and_return('あるあるアリーナ')
      allow(ENV).to receive(:[]).with('SECRETS_MANAGER_ENABLED').and_return('false')

      expect(described_class.missing_env_vars(base_required_env_vars)).to eq(['GEMINI_API_KEY'])
    end

    it 'Secrets Managerで補完可能なAIキーは不足扱いにしないこと' do
      allow(ENV).to receive(:fetch).with('GEMINI_API_KEY', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('APP_NAME', nil).and_return('あるあるアリーナ')
      allow(ENV).to receive(:[]).with('SECRETS_MANAGER_ENABLED').and_return('true')
      allow(ENV).to receive(:fetch).with('GEMINI_SECRET_ARN', nil).and_return('arn:aws:secretsmanager:gemini')
      allow(SecretsManagerClient).to receive(:get_api_key)
        .with(secret_arn: 'arn:aws:secretsmanager:gemini', env_key: 'GEMINI_API_KEY')
        .and_return('secret-value')

      expect(described_class.missing_env_vars(base_required_env_vars)).to eq([])
    end

    it 'Secrets Manager取得失敗時は不足として返すこと' do
      allow(ENV).to receive(:fetch).with('GEMINI_API_KEY', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('APP_NAME', nil).and_return('あるあるアリーナ')
      allow(ENV).to receive(:[]).with('SECRETS_MANAGER_ENABLED').and_return('true')
      allow(ENV).to receive(:fetch).with('GEMINI_SECRET_ARN', nil).and_return('arn:aws:secretsmanager:gemini')
      allow(SecretsManagerClient).to receive(:get_api_key).and_raise(ArgumentError, 'secrets_fetch_failed')

      expect(described_class.missing_env_vars(base_required_env_vars)).to eq(['GEMINI_API_KEY'])
    end
  end
end
