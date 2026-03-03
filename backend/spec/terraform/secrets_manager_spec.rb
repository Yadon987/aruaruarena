# frozen_string_literal: true

require 'rails_helper'

# 検証内容: Secrets Manager統合に必要なTerraform設定が揃っているか
RSpec.describe 'Terraform Secrets Manager', dynamodb: false do
  let(:variables_tf_content) { Rails.root.join('terraform/variables.tf').read }
  let(:secrets_tf_content) { Rails.root.join('terraform/secrets.tf').read }
  let(:iam_tf_content) { Rails.root.join('terraform/iam.tf').read }
  let(:lambda_tf_content) { Rails.root.join('terraform/lambda.tf').read }

  describe 'variables.tf' do
    it 'secrets_manager_enabled変数が定義されていること' do
      expect(variables_tf_content).to match(/variable\s+"secrets_manager_enabled"\s*\{/)
      expect(variables_tf_content).to match(/type\s*=\s*bool/)
      expect(variables_tf_content).to match(/default\s*=\s*false/)
    end
  end

  describe 'secrets.tf' do
    it '3つのSecrets Managerリソースが定義されていること' do
      expect(secrets_tf_content).to match(/resource\s+"aws_secretsmanager_secret"\s+"gemini_api_key"/)
      expect(secrets_tf_content).to match(/resource\s+"aws_secretsmanager_secret"\s+"cerebras_api_key"/)
      expect(secrets_tf_content).to match(/resource\s+"aws_secretsmanager_secret"\s+"groq_api_key"/)
    end

    it '環境ごとの命名規則を使用していること' do
      expect(secrets_tf_content).to match(
        %r{name\s*=\s*"\$\{var\.project_name\}/ai-keys/gemini-\$\{var\.environment\}"}
      )
      expect(secrets_tf_content).to match(
        %r{name\s*=\s*"\$\{var\.project_name\}/ai-keys/cerebras-\$\{var\.environment\}"}
      )
      expect(secrets_tf_content).to match(
        %r{name\s*=\s*"\$\{var\.project_name\}/ai-keys/groq-\$\{var\.environment\}"}
      )
    end
  end

  describe 'iam.tf' do
    it 'LambdaにSecrets Manager読み取り権限が付与されていること' do
      expect(iam_tf_content).to match(/resource\s+"aws_iam_role_policy"\s+"secrets_manager_access"/)
      expect(iam_tf_content).to match(/secretsmanager:GetSecretValue/)
      expect(iam_tf_content).to match(/aws_secretsmanager_secret\.gemini_api_key\.arn/)
      expect(iam_tf_content).to match(/aws_secretsmanager_secret\.cerebras_api_key\.arn/)
      expect(iam_tf_content).to match(/aws_secretsmanager_secret\.groq_api_key\.arn/)
    end
  end

  describe 'lambda.tf' do
    it 'Secrets Manager切り替え用の環境変数が定義されていること' do
      expect(lambda_tf_content).to match(
        /SECRETS_MANAGER_ENABLED\s*=\s*var\.secrets_manager_enabled \? "true" : "false"/
      )
      expect(lambda_tf_content).to match(
        /GEMINI_SECRET_ARN\s*=\s*var\.secrets_manager_enabled \? aws_secretsmanager_secret\.gemini_api_key\.arn : ""/
      )
      expect(lambda_tf_content).to match(
        Regexp.new(
          'CEREBRAS_SECRET_ARN\\s*=\\s*var\\.secrets_manager_enabled \\? ' \
          'aws_secretsmanager_secret\\.cerebras_api_key\\.arn : ""'
        )
      )
      expect(lambda_tf_content).to match(
        /GROQ_SECRET_ARN\s*=\s*var\.secrets_manager_enabled \? aws_secretsmanager_secret\.groq_api_key\.arn : ""/
      )
    end

    it 'Secrets Manager無効時だけ従来のAPIキーを設定すること' do
      expect(lambda_tf_content).to match(
        /GEMINI_API_KEY\s*=\s*var\.secrets_manager_enabled \? "" : var\.gemini_api_key/
      )
      expect(lambda_tf_content).to match(
        /CEREBRAS_API_KEY\s*=\s*var\.secrets_manager_enabled \? "" : var\.cerebras_api_key/
      )
      expect(lambda_tf_content).to match(
        /GROQ_API_KEY\s*=\s*var\.secrets_manager_enabled \? "" : var\.groq_api_key/
      )
    end
  end
end
