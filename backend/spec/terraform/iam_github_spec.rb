# frozen_string_literal: true

require 'rails_helper'

# 検証内容: Terraform iam_github.tf のGitHub Actions用権限が正しいか
# 回帰テストとして実施（既存実装を検証）
RSpec.describe 'Terraform GitHub IAM', dynamodb: false do
  let(:iam_github_tf_path) { Rails.root.join('terraform/iam_github.tf') }
  let(:iam_github_tf_content) do
    File.exist?(iam_github_tf_path) ? File.read(iam_github_tf_path) : ''
  end

  # 検証: フロントエンドデプロイ用ロールの存在
  describe 'frontend_github_actionsロール' do
    it 'aws_iam_role.frontend_github_actionsが定義されていること' do
      expect(iam_github_tf_content).to match(/resource\s+"aws_iam_role"\s+"frontend_github_actions"/)
    end

    it 'GitHub Actions frontend deploy用の説明があること' do
      expect(iam_github_tf_content).to match(/Role for GitHub Actions frontend deploy/)
    end
  end

  # 検証: OIDC前提のAssumeRole設定
  describe 'OIDC信頼ポリシー' do
    it 'sts:AssumeRoleWithWebIdentityを許可していること' do
      expect(iam_github_tf_content).to match(/sts:AssumeRoleWithWebIdentity/)
    end

    it 'GitHub OIDC ProviderをFederated principalにしていること' do
      expect(iam_github_tf_content).to match(/Federated\s*=\s*aws_iam_openid_connect_provider\.github\.arn/)
    end
  end

  # 検証: フロントデプロイに必要な最小権限
  describe 'frontend_github_actionsポリシー' do
    it 'aws_iam_role_policy.frontend_github_actionsが定義されていること' do
      expect(iam_github_tf_content).to match(/resource\s+"aws_iam_role_policy"\s+"frontend_github_actions"/)
    end

    it 'S3 ListBucket権限があること' do
      expect(iam_github_tf_content).to match(/Sid\s*=\s*"S3ListBucket"/)
      expect(iam_github_tf_content).to match(/s3:ListBucket/)
      expect(iam_github_tf_content).to match(/s3:GetBucketLocation/)
    end

    it 'S3オブジェクトの読み書き権限があること' do
      expect(iam_github_tf_content).to match(/Sid\s*=\s*"S3ObjectRW"/)
      expect(iam_github_tf_content).to match(/s3:GetObject/)
      expect(iam_github_tf_content).to match(/s3:PutObject/)
      expect(iam_github_tf_content).to match(/s3:DeleteObject/)
    end

    it 'CloudFront無効化権限があること' do
      expect(iam_github_tf_content).to match(/Sid\s*=\s*"CloudFrontDeployOps"/)
      expect(iam_github_tf_content).to match(/cloudfront:CreateInvalidation/)
      expect(iam_github_tf_content).to match(/cloudfront:GetDistribution/)
      expect(iam_github_tf_content).to match(/cloudfront:GetInvalidation/)
    end

    it 'S3リソースがvar.frontend_s3_bucket_nameを参照していること' do
      expect(iam_github_tf_content).to match(/arn:aws:s3:::\$\{var\.frontend_s3_bucket_name\}/)
      expect(iam_github_tf_content).to match(%r{arn:aws:s3:::\$\{var\.frontend_s3_bucket_name\}/\*})
    end

    it 'CloudFrontリソースがlocal.cloudfront_distributionを参照していること' do
      expect(iam_github_tf_content).to match(/Resource\s*=\s*local\.cloudfront_distribution/)
    end
  end
end
