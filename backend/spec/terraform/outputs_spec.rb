# frozen_string_literal: true

require 'rails_helper'

# 検証内容: Terraform outputs.tf に必要なアウトプットが定義されているか
# このテストはRED状態で出力される（outputs.tfに対象出力が未定義のため）
RSpec.describe 'Terraform Outputs', dynamodb: false do
  let(:outputs_tf_path) { Rails.root.join('terraform/outputs.tf') }
  let(:outputs_tf_content) do
    # ファイルが存在しない場合は空文字を返す（REDテストを失敗させるため）
    File.exist?(outputs_tf_path) ? File.read(outputs_tf_path) : ''
  end

  # 検証: frontend_s3_bucket_nameアウトプットが定義されていること
  # 受入条件: terraform output -raw frontend_s3_bucket_name でバケット名が返されること
  describe 'frontend_s3_bucket_nameアウトプット' do
    # 検証: outputブロックの存在
    it 'outputブロックが定義されていること' do
      # RED: 現在outputs.tfには定義されていないため失敗する
      expect(outputs_tf_content).to match(/output\s+"frontend_s3_bucket_name"\s*\{/)
    end

    # 検証: descriptionの存在（ドキュメンテーション用途）
    it 'descriptionが設定されていること' do
      # RED: 定義されていないため失敗する
      expect(outputs_tf_content).to match(/description\s*=\s*".*S3.*バケット/)
    end

    # 検証: valueがvar.frontend_s3_bucket_nameを参照していること
    # 注意: aws_s3_bucket.frontend.idではなく変数参照（リソースが存在しないため）
    it 'valueがvar.frontend_s3_bucket_nameを参照していること' do
      # RED: 定義されていないため失敗する
      expect(outputs_tf_content).to match(/value\s*=\s*var\.frontend_s3_bucket_name/)
    end
  end

  # 検証: cloudfront_distribution_idアウトプットが定義されていること
  # 受入条件: terraform output -raw cloudfront_distribution_id でIDが返されること
  describe 'cloudfront_distribution_idアウトプット' do
    # 検証: outputブロックの存在
    it 'outputブロックが定義されていること' do
      # RED: 現在outputs.tfには定義されていないため失敗する
      expect(outputs_tf_content).to match(/output\s+"cloudfront_distribution_id"\s*\{/)
    end

    # 検証: descriptionの存在（ドキュメンテーション用途）
    it 'descriptionが設定されていること' do
      # RED: 定義されていないため失敗する
      expect(outputs_tf_content).to match(/description\s*=\s*".*CloudFront.*ディストリビューション/)
    end

    # 検証: valueがaws_cloudfront_distribution.frontend.idを参照していること
    # 注意: importブロックで管理されているためリソース属性を参照可能
    it 'valueがaws_cloudfront_distribution.frontend.idを参照していること' do
      # RED: 定義されていないため失敗する
      expect(outputs_tf_content).to match(/value\s*=\s*aws_cloudfront_distribution\.frontend\.id/)
    end
  end
end
