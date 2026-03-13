# frozen_string_literal: true

# Postのランキング取得と順位計算を担当するサービス
class PostRankingService
  class << self
    # @param limit [Integer]
    # @return [Array<Post>]
    def top_rankings(limit = Post::DEFAULT_RANKING_LIMIT)
      ids = ranking_scope.record_limit(limit).to_a.map(&:id)
      return [] if ids.empty?

      posts = fetch_posts(ids)
      ids.filter_map { |id| posts[id] }
    end

    # @param post [Post]
    # @return [Integer, nil]
    def calculate_rank(post)
      return nil unless post.status == Post::STATUS_SCORED
      return nil if post.score_key.blank?

      higher_count = ranking_scope.where('score_key.lt': post.score_key).count
      higher_count + 1
    end

    # @return [Integer]
    def total_scored_count
      ranking_scope.count
    end

    private

    def ranking_scope
      Post.where(status: Post::STATUS_SCORED)
          .with_index(:ranking_index)
          .scan_index_forward(true)
    end

    def fetch_posts(ids)
      Post.find(ids).index_by(&:id)
    rescue Dynamoid::Errors::RecordNotFound
      # GSI反映遅延で欠損IDが混ざる場合は存在分のみ返す
      ids.filter_map { |id| Post.where(id: id).first }.index_by(&:id)
    end
  end
end
