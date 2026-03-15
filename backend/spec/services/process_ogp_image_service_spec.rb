# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProcessOgpImageService do
  describe '.call' do
    let(:post) { create(:post, :scored, ogp_status: Post::OGP_STATUS_PENDING) }

    it 'OGP画像生成成功時にogp_statusをreadyへ更新すること' do
      allow(UploadOgpImageService).to receive(:call).with(instance_of(Post)).and_return(true)

      expect(described_class.call(post.id)).to be true

      post.reload
      expect(post.ogp_status).to eq(Post::OGP_STATUS_READY)
    end

    it 'OGP画像生成失敗時にogp_statusをfailedへ更新すること' do
      allow(UploadOgpImageService).to receive(:call).with(instance_of(Post)).and_return(false)

      expect(described_class.call(post.id)).to be false

      post.reload
      expect(post.ogp_status).to eq(Post::OGP_STATUS_FAILED)
    end
  end
end
