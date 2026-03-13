# frozen_string_literal: true

# スコア分布を使って平均点を校正するサービス
#
# 目的:
# - AIが中間点に寄りがちな傾向を緩和し、ランキング体験を改善する
# - 過去の scored 投稿分布を参照し、現在の相対順位に応じて目標スコア帯へ寄せる
#
# 注意:
# - test環境ではデフォルト無効
# - 例外時はフェイルオープンで生スコアを返す
class ScoreCalibrationService
  ENABLE_ENV_KEY = 'SCORE_CALIBRATION_ENABLED'
  MIN_HISTORY_ENV_KEY = 'SCORE_CALIBRATION_MIN_HISTORY'
  BLEND_WEIGHT_ENV_KEY = 'SCORE_CALIBRATION_BLEND_WEIGHT'

  DEFAULT_MIN_HISTORY = 80
  DEFAULT_BLEND_WEIGHT = 0.45
  MAX_SCORE = 100.0
  MIN_SCORE = 0.0
  ROUND_PRECISION = 1

  class << self
    # @param raw_score [Numeric] 生の平均点
    # @param post [Post] 対象投稿
    # @return [Float] 校正後スコア
    def calibrate(raw_score:, post:)
      raw = normalize_score(raw_score)
      return raw unless calibration_ready?

      clamp_score(blended_score(raw:, post:))
    rescue StandardError => e
      Rails.logger.warn("[ScoreCalibrationService] 校正をスキップ: #{e.class} - #{e.message}")
      normalize_score(raw_score)
    end

    private

    def normalize_score(raw_score)
      raw_score.to_f.round(ROUND_PRECISION)
    end

    def calibration_ready?
      enabled? && sufficient_history?
    end

    def enabled?
      ENV.fetch(ENABLE_ENV_KEY, 'false') == 'true'
    end

    def sufficient_history?
      Post.total_scored_count >= min_history
    end

    def min_history
      value = ENV.fetch(MIN_HISTORY_ENV_KEY, DEFAULT_MIN_HISTORY).to_i
      value.positive? ? value : DEFAULT_MIN_HISTORY
    end

    def blend_weight
      value = ENV.fetch(BLEND_WEIGHT_ENV_KEY, DEFAULT_BLEND_WEIGHT).to_f
      value.clamp(0.0, 1.0)
    end

    # 上位比率（1.0が最上位、0.0が最下位に近い）
    def top_ratio_by_score(raw_score:, post:)
      total = Post.total_scored_count
      return 0.5 if total <= 0

      score_key = score_key_for(raw_score:, post:)
      higher_count = Post.where(status: Post::STATUS_SCORED)
                         .where('score_key.lt': score_key)
                         .with_index(:ranking_index)
                         .count

      1.0 - (higher_count.to_f / total)
    end

    def blended_score(raw:, post:)
      top_ratio = top_ratio_by_score(raw_score: raw, post:)
      target = target_score_for(top_ratio)
      (raw * (1.0 - blend_weight)) + (target * blend_weight)
    end

    def score_key_for(raw_score:, post:)
      PostScoreKeyService.generate(post:, average_score: raw_score)
    end

    # 上位比率に対する目標スコア帯
    def target_score_for(top_ratio)
      case top_ratio
      when 0.90..1.0
        lerp(88.0, 100.0, (top_ratio - 0.90) / 0.10)
      when 0.70...0.90
        lerp(78.0, 88.0, (top_ratio - 0.70) / 0.20)
      when 0.45...0.70
        lerp(68.0, 78.0, (top_ratio - 0.45) / 0.25)
      else
        lerp(52.0, 68.0, top_ratio / 0.45)
      end
    end

    def lerp(min, max, ratio)
      min + ((max - min) * ratio.clamp(0.0, 1.0))
    end

    def clamp_score(score)
      score.clamp(MIN_SCORE, MAX_SCORE).round(ROUND_PRECISION)
    end
  end
end
