# frozen_string_literal: true

require 'rails_helper'

RSpec.describe RateLimit, type: :model do
  describe '.generate_ip_identifier' do
    it 'IPアドレスから識別子を生成できること' do
      identifier = described_class.generate_ip_identifier('192.168.1.1')
      expect(identifier).to start_with('ip#')
      expect(identifier.length).to eq(19) # 'ip#' + 16文字のハッシュ
    end

    it '同じIPから同じ識別子が生成されること' do
      id1 = described_class.generate_ip_identifier('192.168.1.1')
      id2 = described_class.generate_ip_identifier('192.168.1.1')
      expect(id1).to eq(id2)
    end

    it '異なるIPから異なる識別子が生成されること' do
      id1 = described_class.generate_ip_identifier('192.168.1.1')
      id2 = described_class.generate_ip_identifier('192.168.1.2')
      expect(id1).not_to eq(id2)
    end
  end

  describe '.generate_nickname_identifier' do
    it 'ニックネームから識別子を生成できること' do
      identifier = described_class.generate_nickname_identifier('テストユーザー')
      expect(identifier).to start_with('nick#')
      expect(identifier.length).to eq(21) # 'nick#' (5文字) + 16文字のハッシュ
    end

    it '同じニックネームから同じ識別子が生成されること' do
      id1 = described_class.generate_nickname_identifier('太郎')
      id2 = described_class.generate_nickname_identifier('太郎')
      expect(id1).to eq(id2)
    end
  end

  describe '.limited?' do
    it '識別子が存在する場合はtrueを返すこと' do
      create(:rate_limit, identifier: 'ip#test123', expires_at: Time.now.to_i + 300)
      expect(described_class.limited?('ip#test123')).to be true
    end

    it '識別子が存在しない場合はfalseを返すこと' do
      expect(described_class.limited?('ip#nonexistent')).to be false
    end
  end

  describe '.set_limit' do
    it '指定した秒数後の有効期限で作成されること' do
      current_time = Time.now.to_i
      rate_limit = described_class.set_limit('ip#test123', seconds: 600)
      # String型なので整数に変換して比較
      expect(rate_limit.expires_at.to_i).to eq(current_time + 600)
    end

    it 'デフォルトで5分間の制限を作成すること' do
      current_time = Time.now.to_i
      rate_limit = described_class.set_limit('ip#test123')
      # String型なので整数に変換して比較
      expect(rate_limit.expires_at.to_i).to be_within(1).of(current_time + 300)
    end
  end
end
