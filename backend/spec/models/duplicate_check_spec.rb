# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DuplicateCheck, type: :model do
  describe '.generate_body_hash' do
    it '本文から一意のハッシュを生成できること' do
      hash1 = described_class.generate_body_hash('テスト投稿')
      hash2 = described_class.generate_body_hash('テスト投稿')
      expect(hash1).to eq(hash2)
    end

    it '異なる本文から異なるハッシュを生成すること' do
      hash1 = described_class.generate_body_hash('テスト投稿')
      hash2 = described_class.generate_body_hash('別の投稿')
      expect(hash1).not_to eq(hash2)
    end

    it '正規化により似た投稿は同じハッシュになること' do
      hash1 = described_class.generate_body_hash('Ｔｅｓｔ　投稿')  # 全角・スペース2つ
      hash2 = described_class.generate_body_hash('test 投稿')      # 半角・スペース1つ
      expect(hash1).to eq(hash2)
    end

    it '大文字小文字を区別しないこと' do
      hash1 = described_class.generate_body_hash('Test Post')
      hash2 = described_class.generate_body_hash('test post')
      expect(hash1).to eq(hash2)
    end
  end

  describe '.check' do
    it '既存のチェックを返すこと' do
      body = 'テスト投稿'
      hash = described_class.generate_body_hash(body)
      create(:duplicate_check, body_hash: hash, post_id: 'post-1')

      result = described_class.check(body)

      expect(result).to be_present
      expect(result.post_id).to eq('post-1')
    end

    it '存在しない場合はnilを返すこと' do
      result = described_class.check('存在しない投稿')
      expect(result).to be_nil
    end
  end

  describe '.register' do
    it '重複チェックを登録できること' do
      freeze_time do
        check = described_class.register('テスト投稿', 'post-1')
        expect(check.post_id).to eq('post-1')
        expect(check.expires_at).to eq(Time.now.to_i + 86_400) # 24時間後
      end
    end

    it 'カスタムの保持時間を指定できること' do
      freeze_time do
        check = described_class.register('テスト投稿', 'post-1', hours: 12)
        expect(check.expires_at).to eq(Time.now.to_i + 43_200) # 12時間後
      end
    end
  end
end
