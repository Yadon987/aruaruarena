# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PostRankingService, type: :service do
  describe '.top_rankings' do
    it 'scored投稿をランキング順で返すこと' do
      create(:post, :scored, average_score: 70.0, nickname: '3位')
      create(:post, :scored, average_score: 90.0, nickname: '1位')
      create(:post, :scored, average_score: 80.0, nickname: '2位')

      results = described_class.top_rankings

      expect(results.map(&:nickname)).to eq(%w[1位 2位 3位])
    end

    it 'GSIと本体取得に差があっても存在分だけ返すこと' do
      post = create(:post, :scored, average_score: 90.0, nickname: '1位')
      allow(Post).to receive(:where).and_call_original
      allow(Post).to receive(:find).and_raise(Dynamoid::Errors::RecordNotFound)

      results = described_class.top_rankings

      expect(results.map(&:id)).to include(post.id)
    end
  end

  describe '.calculate_rank' do
    it '順位を返すこと' do
      create(:post, :scored, average_score: 95.0, created_at: '1738040000')
      create(:post, :scored, average_score: 90.0, created_at: '1738041000')
      create(:post, :scored, average_score: 90.0, created_at: '1738040000')
      post = create(:post, :scored, average_score: 85.0, created_at: '1738042000')

      expect(described_class.calculate_rank(post)).to eq(4)
    end

    it 'scored以外はnilを返すこと' do
      expect(described_class.calculate_rank(build(:post, status: Post::STATUS_JUDGING))).to be_nil
    end
  end

  describe '.total_scored_count' do
    it 'scored投稿の件数を返すこと' do
      create_list(:post, 3, :scored)
      create(:post, status: Post::STATUS_JUDGING)

      expect(described_class.total_scored_count).to eq(3)
    end
  end
end
