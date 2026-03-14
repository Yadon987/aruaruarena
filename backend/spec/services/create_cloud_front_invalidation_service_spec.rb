# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CreateCloudFrontInvalidationService, type: :service, dynamodb: false do
  let(:cloudfront_client) { instance_double(Aws::CloudFront::Client) }

  after do
    ENV.delete('CLOUDFRONT_DISTRIBUTION_ID')
  end

  it 'distribution id 未設定時は invalidation を行わないこと' do
    expect(Aws::CloudFront::Client).not_to receive(:new)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be false
  end

  it 'distribution id 未設定時は警告ログを出すこと' do
    allow(Rails.logger).to receive(:warn)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be false
    expect(Rails.logger).to have_received(:warn).with(/CLOUDFRONT_DISTRIBUTION_ID が未設定のため invalidation をスキップ/)
  end

  it 'distribution id が設定されている場合は CloudFront invalidation を行うこと' do
    ENV['CLOUDFRONT_DISTRIBUTION_ID'] = 'DIST123'
    allow(Aws::CloudFront::Client).to receive(:new).and_return(cloudfront_client)
    allow(cloudfront_client).to receive(:create_invalidation)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be true

    expect(Aws::CloudFront::Client).to have_received(:new).with(
      region: 'us-east-1'
    )
    expect(cloudfront_client).to have_received(:create_invalidation).with(
      hash_including(
        distribution_id: 'DIST123',
        invalidation_batch: hash_including(
          paths: {
            quantity: 1,
            items: ['/ogp/posts/post-id.png']
          }
        )
      )
    )
  end

  it 'invalidation 中に例外が発生した場合は false を返すこと' do
    ENV['CLOUDFRONT_DISTRIBUTION_ID'] = 'DIST123'
    allow(Aws::CloudFront::Client).to receive(:new).and_return(cloudfront_client)
    allow(cloudfront_client).to receive(:create_invalidation).and_raise(StandardError, 'timeout')

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be false
  end
end
