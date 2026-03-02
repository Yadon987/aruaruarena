# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CreateCloudFrontInvalidationService, type: :service, dynamodb: false do
  let(:signer) { instance_double(Aws::Sigv4::Signer) }
  let(:signed_request) { instance_double(Aws::Sigv4::Signature, headers: { 'Authorization' => 'signed' }) }
  let(:http_client) { instance_double(Net::HTTP) }
  let(:http_response) { instance_double(Net::HTTPCreated, code: '201') }

  after do
    ENV.delete('CLOUDFRONT_DISTRIBUTION_ID')
    ENV.delete('AWS_ACCESS_KEY_ID')
    ENV.delete('AWS_SECRET_ACCESS_KEY')
    ENV.delete('AWS_SESSION_TOKEN')
  end

  it 'distribution id 未設定時は invalidation を行わないこと' do
    expect(Net::HTTP).not_to receive(:start)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be false
  end

  it 'distribution id が設定されている場合は CloudFront invalidation を行うこと' do
    ENV['CLOUDFRONT_DISTRIBUTION_ID'] = 'DIST123'
    ENV['AWS_ACCESS_KEY_ID'] = 'access-key'
    ENV['AWS_SECRET_ACCESS_KEY'] = 'secret-key'
    ENV['AWS_SESSION_TOKEN'] = 'session-token'

    allow(Aws::Sigv4::Signer).to receive(:new).and_return(signer)
    allow(signer).to receive(:sign_request).and_return(signed_request)
    allow(Net::HTTP).to receive(:start).and_yield(http_client)
    allow(http_client).to receive(:request).and_return(http_response)
    allow(http_response).to receive(:is_a?).with(Net::HTTPCreated).and_return(true)

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be true

    expect(Aws::Sigv4::Signer).to have_received(:new).with(
      service: 'cloudfront',
      region: 'us-east-1',
      access_key_id: 'access-key',
      secret_access_key: 'secret-key',
      session_token: 'session-token'
    )
    expect(signer).to have_received(:sign_request).with(
      hash_including(
        http_method: 'POST',
        headers: { 'content-type' => 'application/xml' },
        body: include('/ogp/posts/post-id.png')
      )
    )
    expect(http_client).to have_received(:request).with(instance_of(Net::HTTP::Post))
  end

  it 'invalidation 中に例外が発生した場合は false を返すこと' do
    ENV['CLOUDFRONT_DISTRIBUTION_ID'] = 'DIST123'
    ENV['AWS_ACCESS_KEY_ID'] = 'access-key'
    ENV['AWS_SECRET_ACCESS_KEY'] = 'secret-key'

    allow(Aws::Sigv4::Signer).to receive(:new).and_return(signer)
    allow(signer).to receive(:sign_request).and_return(signed_request)
    allow(Net::HTTP).to receive(:start).and_raise(StandardError, 'timeout')

    expect(described_class.call(path: '/ogp/posts/post-id.png', post_id: 'post-id')).to be false
  end
end
