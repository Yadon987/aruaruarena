# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CreateCloudFrontInvalidationService, type: :service, dynamodb: false do
  let(:client) { instance_double(Aws::CloudFront::Client) }

  after do
    ENV.delete('CLOUDFRONT_DISTRIBUTION_ID')
  end

  it 'distribution id 未設定時は invalidation を行わないこと' do
    expect(client).not_to receive(:create_invalidation)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id', client: client)).to be false
  end

  it 'CloudFront の invalidation に成功した場合は true を返すこと' do
    ENV['CLOUDFRONT_DISTRIBUTION_ID'] = 'DIST123'
    allow(client).to receive(:create_invalidation)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id', client: client)).to be true
    expect(client).to have_received(:create_invalidation).with(
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

  it 'CloudFront の invalidation に失敗した場合は false を返すこと' do
    ENV['CLOUDFRONT_DISTRIBUTION_ID'] = 'DIST123'
    error = Aws::CloudFront::Errors::AccessDenied.new(nil, 'access denied')
    allow(client).to receive(:create_invalidation).and_raise(error)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id', client: client)).to be false
  end
end
