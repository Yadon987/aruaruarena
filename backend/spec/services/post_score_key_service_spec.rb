# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PostScoreKeyService, type: :service do
  describe '.generate' do
    let(:post) do
      build(:post,
            id: 'test-uuid',
            status: Post::STATUS_SCORED,
            average_score: 85.5,
            created_at: '1738041600')
    end

    it 'score_keyを正しい形式で返すこと' do
      expect(described_class.generate(post:)).to eq('0145#1738041600#test-uuid')
    end

    it '平均点を明示指定してscore_keyを生成できること' do
      expect(described_class.generate(post:, average_score: 90.0)).to eq('0100#1738041600#test-uuid')
    end

    it 'average_scoreがnilならnilを返すこと' do
      expect(described_class.generate(post:, average_score: nil)).to be_nil
    end
  end
end
