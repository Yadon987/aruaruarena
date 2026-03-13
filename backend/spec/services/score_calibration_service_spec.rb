# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ScoreCalibrationService do
  let(:post) { instance_double(Post, id: 'post-1', created_at: '1773319999') }

  around do |example|
    original_enabled = ENV.fetch('SCORE_CALIBRATION_ENABLED', nil)
    original_min_history = ENV.fetch('SCORE_CALIBRATION_MIN_HISTORY', nil)
    original_blend_weight = ENV.fetch('SCORE_CALIBRATION_BLEND_WEIGHT', nil)

    example.run
  ensure
    ENV['SCORE_CALIBRATION_ENABLED'] = original_enabled
    ENV['SCORE_CALIBRATION_MIN_HISTORY'] = original_min_history
    ENV['SCORE_CALIBRATION_BLEND_WEIGHT'] = original_blend_weight
  end

  describe '.calibrate' do
    it '無効時は生スコアをそのまま返すこと' do
      ENV['SCORE_CALIBRATION_ENABLED'] = 'false'

      expect(described_class.calibrate(raw_score: 58.3, post:)).to eq(58.3)
    end

    it '履歴不足時は生スコアをそのまま返すこと' do
      ENV['SCORE_CALIBRATION_ENABLED'] = 'true'
      ENV['SCORE_CALIBRATION_MIN_HISTORY'] = '100'
      allow(Post).to receive(:total_scored_count).and_return(20)

      expect(described_class.calibrate(raw_score: 58.3, post:)).to eq(58.3)
    end

    it '履歴十分時は分布に応じて校正されること' do
      ENV['SCORE_CALIBRATION_ENABLED'] = 'true'
      ENV['SCORE_CALIBRATION_MIN_HISTORY'] = '10'
      ENV['SCORE_CALIBRATION_BLEND_WEIGHT'] = '0.5'

      # 1回目: 履歴十分チェック
      # 2回目: 上位比率計算
      allow(Post).to receive(:total_scored_count).and_return(200, 200)

      scope = instance_double('Dynamoid::Criteria::Chain')
      allow(Post).to receive(:where).with(status: Post::STATUS_SCORED).and_return(scope)
      allow(scope).to receive(:where).with('score_key.lt': kind_of(String)).and_return(scope)
      allow(scope).to receive(:with_index).with(:ranking_index).and_return(scope)
      allow(scope).to receive(:count).and_return(10) # 上位比率 0.95 相当

      calibrated = described_class.calibrate(raw_score: 58.3, post:)
      expect(calibrated).to be > 58.3
      expect(calibrated).to be <= 100.0
    end
  end
end
