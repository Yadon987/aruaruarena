# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DuplicateCheck, type: :model do
  describe '#generate_body_hash' do
    # SHA256ハッシュが正しく返ること
    it 'SHA256ハッシュが正しく返ること' do
      hash = described_class.generate_body_hash('テスト投稿')
      expect(hash).to be_a(String)
      expect(hash.length).to eq(64) # SHA256ハッシュは64文字（16進数）
    end

    it '同じ内容から同じハッシュが生成されること' do
      hash1 = described_class.generate_body_hash('テスト投稿')
      hash2 = described_class.generate_body_hash('テスト投稿')
      expect(hash1).to eq(hash2)
    end

    it '異なる内容から異なるハッシュが生成されること' do
      hash1 = described_class.generate_body_hash('テスト投稿')
      hash2 = described_class.generate_body_hash('異なる投稿')
      expect(hash1).not_to eq(hash2)
    end
  end

  describe '#check' do
    # レコードが存在する場合、trueを返す
    it 'レコードが存在する場合、trueを返すこと' do
      body = 'テスト投稿'
      hash = described_class.generate_body_hash(body)
      create(:duplicate_check, body_hash: hash, post_id: 'test_id', expires_at: Time.now.to_i + 1000)
      expect(described_class.check(body)).to be true
    end

    # レコードが存在しない場合、falseを返す
    it 'レコードが存在しない場合、falseを返すこと' do
      expect(described_class.check('nonexistent_body')).to be false
    end
  end

  describe '#register' do
    # 重複チェックレコードが作成される
    it '重複チェックレコードが作成されること' do
      body = 'テスト投稿'
      expect do
        described_class.register(body: body, post_id: 'test_id')
      end.to change(DuplicateCheck, :count).by(1)

      hash = described_class.generate_body_hash(body)
      duplicate_check = DuplicateCheck.find(hash)
      expect(duplicate_check).to be_present
      expect(duplicate_check.body_hash).to eq(hash)
      expect(duplicate_check.post_id).to eq('test_id')
    end

    # expires_atが現在時刻+86400秒（24時間）に設定されること
    it 'expires_atが現在時刻+86400秒（24時間）に設定されること' do
      current_time = Time.now.to_i
      body = 'テスト投稿'
      described_class.register(body: body, post_id: 'test_id')

      hash = described_class.generate_body_hash(body)
      duplicate_check = DuplicateCheck.find(hash)
      expect(duplicate_check.expires_at).to be_within(1).of(current_time + 86_400)
    end

    # Integer型で保存されること
    it 'Integer型で保存されること' do
      body = 'テスト投稿'
      described_class.register(body: body, post_id: 'test_id')

      hash = described_class.generate_body_hash(body)
      duplicate_check = DuplicateCheck.find(hash)
      expect(duplicate_check.expires_at).to be_a(Integer)
    end
  end
end
