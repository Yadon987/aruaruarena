# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Factories', type: :request do
  describe 'judgments factory' do
    it 'デフォルトでscored状態の投稿が作成されること' do
      judgment = create(:judgment)
      expect(judgment.post.status).to eq('scored')
      expect(judgment.post.score_key).to be_present
    end

    it 'failed traitでも正しく動作すること' do
      judgment = create(:judgment, :failed)
      expect(judgment).not_to be_succeeded
      expect(judgment.error_code).to be_present
    end
  end

  describe 'duplicate_check factory' do
    it '正規化されたハッシュが生成されること' do
      dc = create(:duplicate_check)
      # DuplicateCheck.generate_body_hashと同じロジックで生成されている
      expect(dc.body_hash).to eq(DuplicateCheck.generate_body_hash('test post'))
    end
  end

  describe 'rate_limit factory' do
    it 'IPアドレスから正しい識別子が生成されること' do
      rl = create(:rate_limit)
      # RateLimit.generate_ip_identifierと同じロジックで生成されている
      expected = RateLimit.generate_ip_identifier('127.0.0.1')
      expect(rl.identifier).to eq(expected)
    end
  end
end
