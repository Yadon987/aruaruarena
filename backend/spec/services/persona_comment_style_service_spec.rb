# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PersonaCommentStyleService, type: :service do
  describe '.style' do
    it 'ひろゆき風では共感を再現性に言い換えて語尾を整えること' do
      result = described_class.style('共感が強いです', 'hiroyuki')

      expect(result).to eq('再現性は高いって話です')
    end

    it 'デヴィ婦人風では共感を気品に寄せて語尾を整えること' do
      result = described_class.style('共感がある', 'dewi')

      expect(result).to eq('気品が通っていますわ')
    end

    it '中尾彬風では共感を余韻に寄せて語尾を整えること' do
      result = described_class.style('共感が残る', 'nakao')

      expect(result).to eq('余韻が残るかな')
    end

    it '既存の語尾がキャラに合っていれば維持すること' do
      result = described_class.style('論点はいいですよね', 'hiroyuki')

      expect(result).to eq('論点はいいですよね')
    end

    it '30文字を超える場合は30文字以内に収めること' do
      result = described_class.style('あるある感があって刺さるコメントです', 'nakao')

      expect(result.length).to be <= 30
    end
  end
end
