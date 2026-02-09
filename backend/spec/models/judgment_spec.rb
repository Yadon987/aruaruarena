# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Judgment, type: :model do
  describe 'バリデーション' do
    subject { build(:judgment) }

    it '有効な属性であれば作成できること' do
      expect(subject).to be_valid
    end

    describe 'persona' do
      it 'hiroyukiは有効であること' do
        subject.persona = 'hiroyuki'
        expect(subject).to be_valid
      end

      it 'dewiは有効であること' do
        subject.persona = 'dewi'
        expect(subject).to be_valid
      end

      it 'nakaoは有効であること' do
        subject.persona = 'nakao'
        expect(subject).to be_valid
      end

      it '無効なpersonaは無効であること' do
        subject.persona = 'invalid'
        expect(subject).not_to be_valid
      end
    end

    context '成功時' do
      before { subject.succeeded = true }

      it 'empathyが必須であること' do
        subject.empathy = nil
        expect(subject).not_to be_valid
      end

      it 'humorが必須であること' do
        subject.humor = nil
        expect(subject).not_to be_valid
      end

      it '0〜20の範囲であること' do
        subject.empathy = 0
        expect(subject).to be_valid
      end

      it '20も有効であること' do
        subject.empathy = 20
        expect(subject).to be_valid
      end

      it '-1は無効であること' do
        subject.empathy = -1
        expect(subject).not_to be_valid
      end

      it '21は無効であること' do
        subject.empathy = 21
        expect(subject).not_to be_valid
      end

      it '合計点が0〜100であること' do
        subject.total_score = 0
        expect(subject).to be_valid

        subject.total_score = 100
        expect(subject).to be_valid

        subject.total_score = -1
        expect(subject).not_to be_valid

        subject.total_score = 101
        expect(subject).not_to be_valid
      end

      it 'コメントが必須であること' do
        subject.comment = nil
        expect(subject).not_to be_valid
      end
    end

    context '失敗時' do
      before do
        subject.succeeded = false
        subject.error_code = 'timeout' # error_codeも設定が必要
      end

      it 'スコアが不要であること' do
        subject.empathy = nil
        subject.humor = nil
        expect(subject).to be_valid
      end

      it 'error_codeが必須であること' do
        subject.error_code = nil
        expect(subject).not_to be_valid
      end
    end
  end

  describe '.apply_persona_bias' do
    let(:base_scores) do
      { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 }
    end

    context 'hiroyukiの場合' do
      it '独創性+3、共感度-2のバイアスが適用されること' do
        result = described_class.apply_persona_bias(base_scores, 'hiroyuki')
        expect(result[:originality]).to eq(18)
        expect(result[:empathy]).to eq(13)
      end

      it '最大値/最小値でクリッピングされること' do
        scores = { empathy: 1, humor: 15, brevity: 15, originality: 19, expression: 15 }
        result = described_class.apply_persona_bias(scores, 'hiroyuki')
        expect(result[:originality]).to eq(20) # 最大値クリップ
        expect(result[:empathy]).to eq(0) # 最小値クリップ
      end
    end

    context 'dewiの場合' do
      it '表現力+3、面白さ+2のバイアスが適用されること' do
        result = described_class.apply_persona_bias(base_scores, 'dewi')
        expect(result[:expression]).to eq(18)
        expect(result[:humor]).to eq(17)
      end
    end

    context 'nakaoの場合' do
      it '面白さ+3、共感度+2のバイアスが適用されること' do
        result = described_class.apply_persona_bias(base_scores, 'nakao')
        expect(result[:humor]).to eq(18)
        expect(result[:empathy]).to eq(17)
      end
    end
  end

  describe '.calculate_total_score' do
    it '5項目の合計を返すこと' do
      scores = { empathy: 15, humor: 18, brevity: 12, originality: 20, expression: 16 }
      expect(described_class.calculate_total_score(scores)).to eq(81)
    end
  end
end
