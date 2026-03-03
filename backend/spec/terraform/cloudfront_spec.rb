# frozen_string_literal: true

require 'rails_helper'

# 検証内容: Terraform cloudfront.tf の設定が正しいか
# 回帰テストとして実施（既存実装を検証）
RSpec.describe 'Terraform CloudFront', dynamodb: false do
  let(:cloudfront_tf_path) { Rails.root.join('terraform/cloudfront.tf') }
  let(:cloudfront_tf_content) do
    File.exist?(cloudfront_tf_path) ? File.read(cloudfront_tf_path) : ''
  end

  # 検証: importブロックで既存リソースを管理していること
  # これにより手動作成リソースをTerraform管理下に置いていることを確認
  describe 'importブロック' do
    # 検証: importブロックの存在
    it 'importブロックが定義されていること' do
      expect(cloudfront_tf_content).to match(/import\s*\{/)
    end

    # 検証: import先が正しいリソースであること
    it 'aws_cloudfront_distribution.frontendにimportされていること' do
      expect(cloudfront_tf_content).to match(/to\s*=\s*aws_cloudfront_distribution\.frontend/)
    end

    # 検証: import IDが変数参照であること（ハードコードされていないこと）
    it 'var.cloudfront_distribution_idを参照していること' do
      expect(cloudfront_tf_content).to match(/id\s*=\s*var\.cloudfront_distribution_id/)
    end
  end

  # 検証: CloudFrontディストリビューションの基本設定
  describe 'ディストリビューション基本設定' do
    # 検証: リソース定義の存在
    it 'aws_cloudfront_distribution.frontendリソースが定義されていること' do
      expect(cloudfront_tf_content).to match(/resource\s+"aws_cloudfront_distribution"\s+"frontend"/)
    end

    # 検証: ディストリビューションが有効であること
    it 'enabled = trueであること' do
      expect(cloudfront_tf_content).to match(/enabled\s*=\s*true/)
    end

    # 検証: SPAのエントリーポイント
    it 'default_root_object = "index.html"であること' do
      expect(cloudfront_tf_content).to match(/default_root_object\s*=\s*"index\.html"/)
    end

    # 検証: IPv6対応
    it 'IPv6が有効であること' do
      expect(cloudfront_tf_content).to match(/is_ipv6_enabled\s*=\s*true/)
    end
  end

  # 検証: S3オリジンが変数参照であること
  # 手動作成済みバケットを参照していることを確認
  describe 'S3オリジン設定' do
    # 検証: S3バケット名が変数参照であること
    it 'domain_nameがvar.frontend_s3_bucket_nameを使用していること' do
      expect(cloudfront_tf_content).to match(/var\.frontend_s3_bucket_name/)
    end

    # 検証: OAC IDが変数参照であること
    it 'origin_access_control_idがvar.frontend_origin_access_control_idを使用していること' do
      expect(cloudfront_tf_content).to match(/var\.frontend_origin_access_control_id/)
    end
  end

  # 検証: SPAルーティング対応のカスタムエラーレスポンス
  # 存在しないパスへのアクセス時にindex.htmlを返す設定
  describe 'SPAルーティング対応' do
    # 検証: 403エラー時の処理
    it '403エラー時にindex.htmlが返されること' do
      expect(cloudfront_tf_content).to match(/error_code\s*=\s*403/)
      expect(cloudfront_tf_content).to match(%r{response_page_path\s*=\s*"/index\.html"})
    end

    # 検証: 404エラー時の処理
    it '404エラー時にindex.htmlが返されること' do
      expect(cloudfront_tf_content).to match(/error_code\s*=\s*404/)
      expect(cloudfront_tf_content).to match(%r{response_page_path\s*=\s*"/index\.html"})
    end
  end

  # 検証: HTTPSへリダイレクトされること
  describe 'HTTPSリダイレクト' do
    it 'viewer_protocol_policy = "redirect-to-https"であること' do
      expect(cloudfront_tf_content).to match(/viewer_protocol_policy\s*=\s*"redirect-to-https"/)
    end
  end
end
