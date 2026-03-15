# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'GET /api/posts/:id OGP recovery', type: :request do
  around do |example|
    original_bucket = ENV.fetch('OGP_S3_BUCKET', nil)
    ENV['OGP_S3_BUCKET'] = 'test-ogp-bucket'
    example.run
  ensure
    ENV['OGP_S3_BUCKET'] = original_bucket
  end

  before do
    allow(OgpMetaTagService).to receive(:uploaded_image_exists?).and_return(false)
    allow(JudgmentQueueService).to receive(:enqueue_ogp_generation)
  end

  it 'pending が長時間残っている scored 投稿は詳細取得時に再投入すること' do
    post = create(:post, :scored, ogp_status: Post::OGP_STATUS_PENDING, created_at: 10.minutes.ago.to_i.to_s)

    get "/api/posts/#{post.id}"

    expect(response).to have_http_status(:ok)
    expect(JudgmentQueueService).to have_received(:enqueue_ogp_generation).with(post.id)
    expect(response.parsed_body['ogp_status']).to eq('generating')
  end

  it 'S3に画像がある pending 投稿は詳細取得時に ready を返すこと' do
    post = create(:post, :scored, ogp_status: Post::OGP_STATUS_PENDING, created_at: 10.minutes.ago.to_i.to_s)
    allow(OgpMetaTagService).to receive(:uploaded_image_exists?).with(post: post).and_return(true)

    get "/api/posts/#{post.id}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['ogp_status']).to eq('ready')
    expect(JudgmentQueueService).not_to have_received(:enqueue_ogp_generation)
  end
end
