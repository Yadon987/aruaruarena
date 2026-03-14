# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Terraform IAM設定' do
  let(:iam_tf_content) { Rails.root.join('terraform/iam.tf').read }

  describe 'OGP用S3権限' do
    it 'OGP画像の存在確認に必要な s3:GetObject が許可されていること' do
      expect(iam_tf_content).to match(/resource\s+"aws_iam_role_policy"\s+"s3_ogp_access"/)
      expect(iam_tf_content).to match(/s3:GetObject/)
    end

    it 'OGP画像のアップロードに必要な s3:PutObject が許可されていること' do
      expect(iam_tf_content).to match(/resource\s+"aws_iam_role_policy"\s+"s3_ogp_access"/)
      expect(iam_tf_content).to match(/s3:PutObject/)
    end

    it 'OGP画像プレフィックスのみに権限が絞られていること' do
      expect(iam_tf_content).to match(%r{arn:aws:s3:::\$\{var\.frontend_s3_bucket_name\}/ogp/\*})
    end
  end
end
