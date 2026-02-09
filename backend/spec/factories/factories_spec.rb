# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Factories', type: :model do
  describe 'judgments factory' do
    it 'デフォルトで有効な属性で作成できること' do
      judgment = build(:judgment)
      expect(judgment).to be_valid
      expect(judgment.persona).to eq('hiroyuki')
      expect(judgment).to be_succeeded
    end

    it 'failed traitでも正しく動作すること' do
      judgment = build(:judgment, :failed)
      expect(judgment).not_to be_succeeded
      expect(judgment.error_code).to be_present
    end
  end

  describe 'duplicate_check factory' do
    it '正規化されたハッシュが生成されること' do
      dc = build(:duplicate_check)
      # DuplicateCheck.generate_body_hashと同じロジックで生成されている
      expect(dc.body_hash).to be_present
      expect(dc.post_id).to be_present
      expect(dc.expires_at).to be_present
    end
  end

  describe 'rate_limit factory' do
    it 'IPアドレスから正しい識別子が生成されること' do
      rl = build(:rate_limit)
      # RateLimit.generate_ip_identifierと同じロジックで生成されている
      expect(rl.identifier).to be_present
      expect(rl.identifier).to start_with('ip#')
      expect(rl.expires_at).to be_present
    end
  end
end
