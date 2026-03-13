# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PersonaCommentStyleService, type: :service do
  describe '.style' do
    it 'ひろゆき風では共感を再現性に言い換えて語尾を整えること' do
      result = described_class.style('共感が強いです', 'hiroyuki')

      # 「共感」が「再現性」に変換され、ひろゆき風の語尾になることを確認
      expect(result).to eq('再現性は高いって話です')
    end

    it 'デヴィ婦人風では共感を気品に寄せて語尾を整えること' do
      result = described_class.style('共感がある', 'dewi')

      # デヴィ婦人風の語彙と語尾に整形されることを確認
      expect(result).to eq('気品が通っていますわ')
    end

    it '中尾彬風では共感を余韻に寄せて語尾を整えること' do
      result = described_class.style('共感が残る', 'nakao')

      # 中尾彬風の語彙と余韻のある語尾に整形されることを確認
      expect(result).to eq('余韻が残るかな')
    end

    it '既存の語尾がキャラに合っていれば維持すること' do
      result = described_class.style('論点はいいですよね', 'hiroyuki')

      # 既に適切な語尾なら不要な再変換をしないことを確認
      expect(result).to eq('論点はいいですよね')
    end

    it 'ひろゆき風で自然な よね 終止なら語尾を重ねないこと' do
      result = described_class.style('誰にでもあるよね', 'hiroyuki')

      expect(result).to eq('誰にでもあるよね')
    end

    it '中尾彬風で自然な ね 終止なら語尾を重ねないこと' do
      result = described_class.style('誰にでもあるね', 'nakao')

      expect(result).to eq('誰にでもあるね')
    end

    it 'デヴィ婦人風で自然な ですわね 終止なら語尾を重ねないこと' do
      result = described_class.style('簡潔ですわね', 'dewi')

      expect(result).to eq('簡潔ですわね')
    end

    it '中尾彬風の二重語尾を自然な形に戻すこと' do
      result = described_class.style('誰にでもあるねだね', 'nakao')

      expect(result).to eq('誰にでもあるね')
    end

    it 'デヴィ婦人風の二重語尾を自然な形に戻すこと' do
      result = described_class.style('簡潔ですわねですわ', 'dewi')

      expect(result).to eq('簡潔ですわね')
    end

    it 'デヴィ婦人風で ますですわ を自然な敬体に戻すこと' do
      result = described_class.style('品が際立ちますですわ', 'dewi')

      expect(result).to eq('品が際立ちますわ')
    end

    it '30文字を超える場合は30文字以内に収めること' do
      result = described_class.style('あるある感があって刺さるコメントです', 'nakao')

      # 変換後もコメント長が上限30文字以内に収まることを確認
      expect(result.length).to be <= 30
    end

    it '空文字列は空文字列のまま返すこと' do
      result = described_class.style('', 'hiroyuki')

      # 空入力を安全にそのまま返すことを確認
      expect(result).to eq('')
    end

    it 'commentがnilの場合は空文字列を返すこと' do
      result = described_class.style(nil, 'dewi')

      # nil入力でも例外を出さず空文字列へ正規化することを確認
      expect(result).to eq('')
    end

    it '未知のpersonaではArgumentErrorを送出すること' do
      expect do
        described_class.style('テスト', 'unknown')
      end.to raise_error(ArgumentError, 'Unsupported persona: unknown')
    end

    it 'personaがnilの場合はArgumentErrorを送出すること' do
      expect do
        described_class.style('テスト', nil)
      end.to raise_error(ArgumentError, 'Unsupported persona: ')
    end
  end
end
