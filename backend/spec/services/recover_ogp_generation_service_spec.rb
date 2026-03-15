# frozen_string_literal: true

require 'rails_helper'

RSpec.describe RecoverOgpGenerationService do
  describe '.call' do
    let(:post) { create(:post, status: Post::STATUS_SCORED, ogp_status: ogp_status, created_at: created_at) }
    let(:created_at) { 10.minutes.ago.to_i.to_s }

    before do
      allow(OgpMetaTagService).to receive(:uploaded_image_exists?).with(post: post).and_return(false)
      allow(JudgmentQueueService).to receive(:enqueue_ogp_generation)
      ENV['OGP_S3_BUCKET'] = 'test-ogp-bucket'
    end

    after do
      ENV.delete('OGP_S3_BUCKET')
    end

    context 'pending のまま一定時間経過している場合' do
      let(:ogp_status) { Post::OGP_STATUS_PENDING }

      it 'OGP生成ジョブを再投入すること' do
        expect(described_class.call(post)).to be true
        expect(JudgmentQueueService).to have_received(:enqueue_ogp_generation).with(post.id)
      end
    end

    context 'pending でもS3に画像がある場合' do
      let(:ogp_status) { Post::OGP_STATUS_PENDING }

      it 'ready に補正すること' do
        allow(OgpMetaTagService).to receive(:uploaded_image_exists?).with(post: post).and_return(true)

        expect(described_class.call(post)).to be true
        expect(post.reload.ogp_status).to eq(Post::OGP_STATUS_READY)
        expect(JudgmentQueueService).not_to have_received(:enqueue_ogp_generation)
      end
    end

    context 'generating が長時間続いている場合' do
      let(:ogp_status) { Post::OGP_STATUS_GENERATING }

      it 'pending へ戻して再投入すること' do
        expect(described_class.call(post)).to be true
        expect(post.reload.ogp_status).to eq(Post::OGP_STATUS_PENDING)
        expect(JudgmentQueueService).to have_received(:enqueue_ogp_generation).with(post.id)
      end
    end

    context 'pending でも投稿直後の場合' do
      let(:ogp_status) { Post::OGP_STATUS_PENDING }
      let(:created_at) { Time.current.to_i.to_s }

      it '再投入しないこと' do
        expect(described_class.call(post)).to be false
        expect(JudgmentQueueService).not_to have_received(:enqueue_ogp_generation)
      end
    end

    context 'scored 以外の投稿の場合' do
      let(:post) { create(:post, status: Post::STATUS_FAILED, ogp_status: Post::OGP_STATUS_PENDING) }
      let(:ogp_status) { Post::OGP_STATUS_PENDING }

      it '何もしないこと' do
        expect(described_class.call(post)).to be false
        expect(JudgmentQueueService).not_to have_received(:enqueue_ogp_generation)
      end
    end
  end
end
