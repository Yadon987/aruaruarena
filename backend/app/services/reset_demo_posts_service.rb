# frozen_string_literal: true

# ダミー投稿の初期化と再投入を行うサービス
class ResetDemoPostsService
  class << self
    delegate :call, to: :new
  end

  def call
    clear_tables!

    DemoPostsSeedData::POSTS.each_with_index.map do |entry, index|
      build_demo_post!(entry:, index:)
    end
  end

  private

  def clear_tables!
    [Judgment, Post, RateLimit, DuplicateCheck].each(&:delete_all)
  end

  def build_demo_post!(entry:, index:)
    post_id = SecureRandom.uuid
    post = Post.new(post_attributes(entry:, index:, post_id:))
    post.score_key = post.generate_score_key
    post.save!

    build_judgments!(post:, index:)
    post
  end

  def build_judgments!(post:, index:)
    totals = judgment_totals(post.average_score.to_f, index)

    DemoPostsSeedData::PERSONAS.each_with_index do |persona, persona_index|
      Judgment.create!(judgment_attributes(post:, persona:, persona_index:, total_score: totals[persona_index]))
    end
  end

  def demo_average_score(index)
    ((225 - (index * 2)) / 3.0).round(1)
  end

  def judgment_totals(average_score, index)
    total_sum = (average_score * DemoPostsSeedData::PERSONAS.count).round
    base = total_sum / 3
    totals = [base, base, base]

    (total_sum - (base * 3)).times do |offset|
      totals[judgment_bonus_order(index)[offset]] += 1
    end

    totals
  end

  def score_breakdown(total_score, persona)
    scores = Judgment::SCORE_FIELDS.index_with { 13 }
    remaining = total_score - (Judgment::SCORE_FIELDS.count * 13)

    DemoPostsSeedData::SCORE_PATTERNS.fetch(persona).cycle do |field|
      break if remaining.zero?

      next if scores[field] >= Judgment::MAX_SCORE_PER_ITEM

      scores[field] += 1
      remaining -= 1
    end

    scores
  end

  def post_attributes(entry:, index:, post_id:)
    {
      id: post_id,
      nickname: entry[:nickname],
      body: entry[:body],
      status: Post::STATUS_SCORED,
      average_score: demo_average_score(index),
      judges_count: DemoPostsSeedData::PERSONAS.count,
      created_at: (DemoPostsSeedData::BASE_CREATED_AT + (index * 60)).to_s
    }
  end

  def judgment_attributes(post:, persona:, persona_index:, total_score:)
    {
      post_id: post.id,
      persona: persona,
      id: SecureRandom.uuid,
      succeeded: true,
      **score_breakdown(total_score, persona),
      total_score: total_score,
      comment: DemoPostsSeedData::COMMENT_TEMPLATES.fetch(persona),
      judged_at: (post.created_at.to_i + persona_index + 1).to_s
    }
  end

  def judgment_bonus_order(index)
    case index % 3
    when 0 then [2, 0, 1]
    when 1 then [0, 2, 1]
    else [1, 2, 0]
    end
  end
end
