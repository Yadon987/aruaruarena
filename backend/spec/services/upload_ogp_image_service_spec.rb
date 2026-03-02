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
  let(:aws_region) { ENV.fetch('AWS_REGION', 'ap-northeast-1') }

  before do
    allow(Post).to receive(:find).with('post-id').and_return(post)
    allow(OgpGeneratorService).to receive(:call).with(post).and_return(mock_png_binary)
    allow(CreateCloudFrontInvalidationService).to receive(:call).and_return(true)
    allow(LogOgpGenerationEventService).to receive(:call)
    ENV['OGP_S3_BUCKET'] = 'test-ogp-bucket'
  end

  after do
    ENV.delete('OGP_S3_BUCKET')
  end

  describe 'OGP_S3_BUCKET未設定時' do
    before do
      ENV.delete('OGP_S3_BUCKET')
    end

    it 'S3クライアントを生成せず早期リターンすること' do
      expect(Aws::S3::Client).not_to receive(:new)

      expect(described_class.call('post-id')).to be false
    end
  end

  it '生成したOGP画像をS3へ保存すること' do
    expect(described_class.call('post-id', s3_client:)).to be true

    request = s3_client.api_requests.find { |api_request| api_request[:operation_name] == :put_object }
    expect(request.dig(:params, :bucket)).to eq('test-ogp-bucket')
    expect(request.dig(:params, :key)).to eq('ogp/posts/post-id.png')
    expect(request.dig(:params, :content_type)).to eq('image/png')
    expect(request.dig(:params, :cache_control)).to eq('max-age=604800, public')
    expect(CreateCloudFrontInvalidationService).to have_received(:call).with(
      path: '/ogp/posts/post-id.png',
      post_id: 'post-id'
    )
    expect(LogOgpGenerationEventService).to have_received(:call).with(
      event: 'ogp_generation_started',
      post:
    )
    expect(LogOgpGenerationEventService).to have_received(:call).with(
      event: 'ogp_s3_upload_succeeded',
      post:,
      bucket_name: 'test-ogp-bucket',
      object_key: 'ogp/posts/post-id.png'
    )
  end

  it 'invalidation に失敗しても S3保存成功なら true を返すこと' do
    allow(CreateCloudFrontInvalidationService).to receive(:call).and_return(false)

    expect(described_class.call('post-id', s3_client:)).to be true
  end

  it '画像生成に失敗した場合はS3保存しないこと' do
    allow(OgpGeneratorService).to receive(:call).with(post).and_return(nil)

    expect(described_class.call('post-id', s3_client:)).to be false
    expect(s3_client.api_requests).to be_empty
    expect(CreateCloudFrontInvalidationService).not_to have_received(:call)
  end

  it 'スコア未確定の投稿はS3保存しないこと' do
    allow(post).to receive(:status).and_return(Post::STATUS_FAILED)

    expect(described_class.call('post-id', s3_client:)).to be false
    expect(s3_client.api_requests).to be_empty
    expect(CreateCloudFrontInvalidationService).not_to have_received(:call)
  end

  it 'S3クライアント生成時にHTTPタイムアウトを設定すること' do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)

    described_class.call('post-id')

    expect(Aws::S3::Client).to have_received(:new).with(
      region: aws_region,
      http_open_timeout: 5,
      http_read_timeout: 5
    )
  end

  it 'S3アップロード失敗時にエラーログを出力しfalseを返すこと' do
    s3_client.stub_responses(:put_object, Aws::S3::Errors::ServiceError.new(nil, 'upload failed'))

    allow(Rails.logger).to receive(:error)

    expect(described_class.call('post-id', s3_client:)).to be false
    expect(Rails.logger).to have_received(:error).with(/S3 upload failed/)
    expect(CreateCloudFrontInvalidationService).not_to have_received(:call)
    # S3アップロード失敗時はogp_s3_upload_succeededログを出力しないこと
    expect(LogOgpGenerationEventService).not_to have_received(:call).with(
      hash_including(event: 'ogp_s3_upload_succeeded')
    )
  end
end
