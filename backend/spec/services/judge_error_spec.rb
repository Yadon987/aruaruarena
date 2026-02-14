# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JudgeError do
  describe '継承' do
    it 'StandardErrorを継承していること' do
      expect(described_class).to be < StandardError
    end
  end

  describe '#initialize' do
    context '必須引数のみの場合' do
      let(:error) { described_class.new(judge_persona: 'hiroyuki', error_code: 'timeout') }

      it 'personaが正しく設定されること' do
        expect(error.persona).to eq('hiroyuki')
      end

      it 'error_codeが正しく設定されること' do
        expect(error.error_code).to eq('timeout')
      end

      it 'original_errorがnilであること' do
        expect(error.original_error).to be_nil
      end

      it 'messageが正しい形式であること' do
        expect(error.message).to eq('[JudgeError] persona=hiroyuki, error_code=timeout')
      end
    end

    context 'original_errorを含む場合' do
      let(:original) { StandardError.new('original message') }
      let(:error) do
        described_class.new(judge_persona: 'dewi', error_code: 'provider_error', original_error: original)
      end

      it 'original_errorが正しく設定されること' do
        expect(error.original_error).to eq(original)
      end

      it 'personaが正しく設定されること' do
        expect(error.persona).to eq('dewi')
      end

      it 'error_codeが正しく設定されること' do
        expect(error.error_code).to eq('provider_error')
      end
    end

    context 'すべての審査員IDで初期化できること' do
      it 'hiroyukiで初期化できること' do
        error = described_class.new(judge_persona: 'hiroyuki', error_code: 'test')
        expect(error.persona).to eq('hiroyuki')
      end

      it 'dewiで初期化できること' do
        error = described_class.new(judge_persona: 'dewi', error_code: 'test')
        expect(error.persona).to eq('dewi')
      end

      it 'nakaoで初期化できること' do
        error = described_class.new(judge_persona: 'nakao', error_code: 'test')
        expect(error.persona).to eq('nakao')
      end
    end
  end

  describe '属性アクセサ' do
    let(:error) do
      described_class.new(judge_persona: 'nakao', error_code: 'invalid_response')
    end

    it 'personaが読み取り可能であること' do
      expect(error.respond_to?(:persona)).to be true
    end

    it 'error_codeが読み取り可能であること' do
      expect(error.respond_to?(:error_code)).to be true
    end

    it 'original_errorが読み取り可能であること' do
      expect(error.respond_to?(:original_error)).to be true
    end

    it 'personaは書き込み不可であること' do
      expect(error.respond_to?(:persona=)).to be false
    end

    it 'error_codeは書き込み不可であること' do
      expect(error.respond_to?(:error_code=)).to be false
    end

    it 'original_errorは書き込み不可であること' do
      expect(error.respond_to?(:original_error=)).to be false
    end
  end

  describe '#to_h' do
    context 'original_errorがない場合' do
      let(:error) { described_class.new(judge_persona: 'hiroyuki', error_code: 'timeout') }

      it '正しいハッシュを返すこと' do
        expect(error.to_h).to eq({
          persona: 'hiroyuki',
          error_code: 'timeout',
          message: '審査エラーが発生しました'
        })
      end
    end

    context 'original_errorがある場合' do
      let(:original) { Timeout::Error.new('API timeout') }
      let(:error) do
        described_class.new(judge_persona: 'dewi', error_code: 'provider_error', original_error: original)
      end

      it '正しいハッシュを返すこと' do
        expect(error.to_h).to eq({
          persona: 'dewi',
          error_code: 'provider_error',
          message: 'Timeout::Error: 審査エラーが発生しました'
        })
      end

      it '元の例外のクラス名が含まれること' do
        expect(error.to_h[:message]).to include('Timeout::Error')
      end
    end
  end

  describe '例外としての動作' do
    it 'raiseで発生させることができること' do
      expect do
        raise described_class.new(judge_persona: 'hiroyuki', error_code: 'test')
      end.to raise_error(described_class)
    end

    it 'rescueで捕捉できること' do
      caught = false
      begin
        raise described_class.new(judge_persona: 'hiroyuki', error_code: 'test')
      rescue described_class => e
        caught = true
        expect(e.persona).to eq('hiroyuki')
      end
      expect(caught).to be true
    end

    it 'StandardErrorとしても捕捉できること' do
      expect do
        raise described_class.new(judge_persona: 'hiroyuki', error_code: 'test')
      end.to raise_error(StandardError)
    end
  end
end
