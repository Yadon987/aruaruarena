# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ResetDemoPostsService, type: :service do
  describe '.call' do
    it '投稿関連データを初期化して20件のダミー投稿を作成すること' do
      create(:post, :scored, nickname: '既存投稿', body: '古い投稿です', average_score: 80.0)
      create(:judgment, post_id: Post.first.id, persona: 'hiroyuki')
      RateLimit.create!(identifier: 'nick#old', expires_at: Time.current.to_i + 300)
      DuplicateCheck.create!(body_hash: 'old_hash', post_id: SecureRandom.uuid, expires_at: Time.current.to_i + 3600)

      posts = described_class.call

      expect(posts.count).to eq(20)
      expect(Post.count).to eq(20)
      expect(Judgment.count).to eq(60)
      expect(RateLimit.count).to eq(0)
      expect(DuplicateCheck.count).to eq(0)
      expect(Post.all.map(&:nickname)).not_to include('既存投稿')
    end

    it 'ランキング順が1位から20位まで一意に決まること' do
      described_class.call

      rankings = Post.top_rankings(20)
      scores = rankings.map { |post| post.average_score.to_f }
      ranks = rankings.map(&:calculate_rank)

      expect(rankings.count).to eq(20)
      expect(scores).to all(be_between(65.0, 75.0))
      expect(scores).to eq(scores.sort.reverse)
      expect(ranks).to eq((1..20).to_a)
    end

    it '各投稿に3人分の成功Judgmentを紐づけて平均点と整合すること' do
      posts = described_class.call

      posts.each do |post|
        judgments = Judgment.where(post_id: post.id).to_a.sort_by(&:persona)
        average_score = (judgments.sum(&:total_score) / 3.0).round(1)

        aggregate_failures do
          expect(post.status).to eq(Post::STATUS_SCORED)
          expect(post.judges_count).to eq(3)
          expect(post.score_key).to be_present
          expect(judgments.count).to eq(3)
          expect(judgments.map(&:persona)).to match_array(%w[dewi hiroyuki nakao])
          expect(judgments).to all(have_attributes(succeeded: true))
          expect(average_score).to eq(post.average_score.to_f)
        end
      end
    end
  end
end
