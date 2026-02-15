# frozen_string_literal: true

# RejudgePostService - failed投稿の指定審査員のみ再審査するサービス
class RejudgePostService
  # 成功審査員が2人以上ならscored
  SCORING_THRESHOLD = 2
  # average_scoreは小数第1位で丸める
  ROUND_PRECISION = 1
  ERROR_CODE_THREAD_EXCEPTION = 'thread_exception'

  VALID_PERSONAS = %w[hiroyuki dewi nakao].freeze

  ADAPTERS = {
    'hiroyuki' => GeminiAdapter,
    'dewi' => DewiAdapter,
    'nakao' => OpenAiAdapter
  }.freeze

  def initialize(post_id, failed_personas:)
    validate_personas!(failed_personas)
    @failed_personas = failed_personas
    @post = Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[RejudgePostService] Post not found: #{post_id}")
    @post = nil
  end

  def execute
    return if @post.nil?

    post_snapshot, judgments_snapshot, existing_judgments = prepare_snapshots
    run_rejudge_for_targets(existing_judgments)
    update_post_status!
  rescue StandardError
    # Judgment更新後にPost更新が失敗した場合でも、実行前の整合状態に戻す
    rollback_rejudge!(judgments_snapshot:, post_snapshot:)
    raise
  end

  class << self
    def call(post_id, failed_personas:)
      new(post_id, failed_personas: failed_personas).execute
    end
  end

  private

  def validate_personas!(failed_personas)
    raise ArgumentError, 'failed_personas must be an array' unless failed_personas.is_a?(Array)
    raise ArgumentError, 'failed_personas must not be empty' if failed_personas.empty?
    raise ArgumentError, 'failed_personas must be unique' if failed_personas.uniq.size != failed_personas.size
    raise ArgumentError, 'invalid persona included' unless (failed_personas - VALID_PERSONAS).empty?
  end

  def prepare_snapshots
    post_snapshot = snapshot_post
    existing_judgments = Judgment.where(post_id: @post.id).to_a.index_by(&:persona)
    judgments_snapshot = @failed_personas.index_with { |persona| snapshot_judgment(existing_judgments[persona]) }
    [post_snapshot, judgments_snapshot, existing_judgments]
  end

  def run_rejudge_for_targets(existing_judgments)
    @failed_personas.each do |persona|
      rejudge_persona!(persona, existing_judgments[persona])
    end
  end

  def rejudge_persona!(persona, existing_judgment = nil)
    result = ADAPTERS.fetch(persona).new.judge(@post.body, persona: persona)
    attrs = base_attrs(result)
    attrs.merge!(score_attrs(result)) if result.succeeded
    save_judgment!(persona, attrs, existing_judgment)
  rescue StandardError => e
    Rails.logger.error("[RejudgePostService] Rejudge failed: persona=#{persona} error=#{e.class} - #{e.message}")
    save_judgment!(persona, base_attrs(failed_result(ERROR_CODE_THREAD_EXCEPTION)), existing_judgment)
  end

  def failed_result(error_code)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: error_code,
      scores: nil,
      comment: nil
    )
  end

  def base_attrs(result)
    {
      id: SecureRandom.uuid,
      succeeded: result.succeeded,
      error_code: result.error_code,
      judged_at: Time.now.to_i.to_s
    }
  end

  def score_attrs(result)
    {
      empathy: result.scores[:empathy],
      humor: result.scores[:humor],
      brevity: result.scores[:brevity],
      originality: result.scores[:originality],
      expression: result.scores[:expression],
      total_score: Judgment.calculate_total_score(result.scores),
      comment: result.comment
    }
  end

  def save_judgment!(persona, attrs, existing_judgment = nil)
    judgment = existing_judgment || Judgment.new(post_id: @post.id, persona: persona)
    judgment.assign_attributes(attrs)
    return judgment.save! if attrs[:succeeded]

    # 失敗時は過去のスコアが残らないようにスコア系カラムを明示的にクリアする
    judgment.assign_attributes(
      empathy: nil,
      humor: nil,
      brevity: nil,
      originality: nil,
      expression: nil,
      total_score: nil,
      comment: nil
    )
    judgment.save!
  end

  def snapshot_judgment(judgment)
    return nil if judgment.nil?

    {
      id: judgment.id,
      succeeded: judgment.succeeded,
      error_code: judgment.error_code,
      judged_at: judgment.judged_at,
      empathy: judgment.empathy,
      humor: judgment.humor,
      brevity: judgment.brevity,
      originality: judgment.originality,
      expression: judgment.expression,
      total_score: judgment.total_score,
      comment: judgment.comment
    }
  end

  def snapshot_post
    {
      status: @post.status,
      average_score: @post.average_score,
      judges_count: @post.judges_count,
      score_key: @post.score_key
    }
  end

  def rollback_rejudge!(judgments_snapshot:, post_snapshot:)
    @failed_personas.each do |persona|
      restore_judgment!(persona, judgments_snapshot[persona])
    end

    @post.assign_attributes(post_snapshot)
    @post.save!
  rescue StandardError => e
    Rails.logger.error("[RejudgePostService] Rollback failed: #{e.class} - #{e.message}")
  end

  def restore_judgment!(persona, snapshot)
    current = Judgment.where(post_id: @post.id).to_a.find { |judgment| judgment.persona == persona }

    if snapshot.nil?
      current&.destroy
      return
    end

    judgment = current || Judgment.new(post_id: @post.id, persona: persona)
    judgment.assign_attributes(snapshot)
    judgment.save!
  end

  def update_post_status!
    successful_judgments = Judgment.where(post_id: @post.id).to_a.select(&:succeeded)
    succeeded_count = successful_judgments.size

    @post.judges_count = succeeded_count

    if succeeded_count >= SCORING_THRESHOLD
      total = successful_judgments.sum(&:total_score)
      @post.average_score = (total.to_f / succeeded_count).round(ROUND_PRECISION)
      @post.update_status!(Post::STATUS_SCORED)
    else
      @post.average_score = nil
      @post.update_status!(Post::STATUS_FAILED)
    end
  end
end
