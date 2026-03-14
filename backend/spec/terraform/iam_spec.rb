# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Terraform IAM設定' do
  let(:iam_tf_content) { Rails.root.join('terraform/iam.tf').read }
  let(:s3_ogp_access_block) do
    iam_tf_content.match(
      /resource\s+"aws_iam_role_policy"\s+"s3_ogp_access"\s+\{.*?^\}/m
    )&.[](0)
  end

  describe 'OGP用S3権限' do
    it 's3_ogp_access ポリシーが定義されていること' do
      expect(s3_ogp_access_block).not_to be_nil
    end

    it 's3_ogp_access ポリシー内に必要な権限が含まれていること' do
      expect(s3_ogp_access_block).to match(/s3:GetObject/)
      expect(s3_ogp_access_block).to match(/s3:PutObject/)
      expect(s3_ogp_access_block).to match(%r{arn:aws:s3:::\$\{var\.frontend_s3_bucket_name\}/ogp/\*})
    end
  end
end
