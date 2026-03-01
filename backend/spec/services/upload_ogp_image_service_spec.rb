# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UploadOgpImageService, type: :service, dynamodb: false do
  include OgpTestHelpers

  let(:post) do
    instance_double(
      Post,
      id: 'post-id',
      status: Post::STATUS_SCORED
    )
  end
  let(:s3_client) { Aws::S3::Client.new(region: 'ap-northeast-1', stub_responses: true) }

  before do
    allow(Post).to receive(:find).with('post-id').and_return(post)
    allow(OgpGeneratorService).to receive(:call).with('post-id').and_return(mock_png_binary)
    ENV['OGP_S3_BUCKET'] = 'test-ogp-bucket'
  end

  after do
    ENV.delete('OGP_S3_BUCKET')
  end

  it '生成したOGP画像をS3へ保存すること' do
    expect(described_class.call('post-id', s3_client:)).to be true

    request = s3_client.api_requests.find { |api_request| api_request[:operation_name] == :put_object }
    expect(request.dig(:params, :bucket)).to eq('test-ogp-bucket')
    expect(request.dig(:params, :key)).to eq('ogp/posts/post-id.png')
    expect(request.dig(:params, :content_type)).to eq('image/png')
    expect(request.dig(:params, :cache_control)).to eq('max-age=604800, public')
  end

  it '画像生成に失敗した場合はS3保存しないこと' do
    allow(OgpGeneratorService).to receive(:call).with('post-id').and_return(nil)

    expect(described_class.call('post-id', s3_client:)).to be false
    expect(s3_client.api_requests).to be_empty
  end

  it 'スコア未確定の投稿はS3保存しないこと' do
    allow(post).to receive(:status).and_return(Post::STATUS_FAILED)

    expect(described_class.call('post-id', s3_client:)).to be false
    expect(s3_client.api_requests).to be_empty
  end
end
