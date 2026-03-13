# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PersonaBiasService, type: :service do
  let(:base_scores) do
    { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 }
  end

  describe '.apply_persona_bias' do
    it 'ひろゆき風の補正を適用すること' do
      result = described_class.apply_persona_bias(base_scores, 'hiroyuki')

      expect(result[:originality]).to eq(18)
      expect(result[:empathy]).to eq(13)
    end

    it 'デヴィ婦人風の補正を適用すること' do
      result = described_class.apply_persona_bias(base_scores, 'dewi')

      expect(result[:expression]).to eq(18)
      expect(result[:humor]).to eq(17)
    end

    it '中尾彬風の補正を適用すること' do
      result = described_class.apply_persona_bias(base_scores, 'nakao')

      expect(result[:humor]).to eq(18)
      expect(result[:empathy]).to eq(17)
    end

    it '未知のpersonaでは例外を送出すること' do
      expect do
        described_class.apply_persona_bias(base_scores, 'unknown')
      end.to raise_error(ArgumentError, 'Unsupported persona: unknown')
    end
  end

  describe '.calculate_total_score' do
    it '5項目の合計を返すこと' do
      scores = { empathy: 15, humor: 18, brevity: 12, originality: 20, expression: 16 }

      expect(described_class.calculate_total_score(scores)).to eq(81)
    end
  end
end
