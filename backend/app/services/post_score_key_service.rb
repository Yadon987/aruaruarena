# frozen_string_literal: true

# scored投稿のscore_key生成を担当するサービス
class PostScoreKeyService
  class << self
    # @param post [Post]
    # @param average_score [Numeric, nil]
    # @return [String, nil]
    def generate(post:, average_score: post.average_score)
      return nil if average_score.blank?

      inv_score = Post::SCORE_BASE - (average_score.to_f * Post::SCORE_MULTIPLIER).round
      format('%<score>04d#%<created_at>010d#%<post_id>s',
             score: inv_score,
             created_at: post.created_at.to_i,
             post_id: post.id)
    end
  end
end
