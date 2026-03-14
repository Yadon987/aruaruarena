# frozen_string_literal: true

require 'spec_helper'
require_relative '../support/dynamodb_constants'

RSpec.describe DynamoDBConstants do
  describe '.normalized_endpoint' do
    it '未指定時はテスト用の既定エンドポイントを返す' do
      expect(described_class.normalized_endpoint(nil)).to eq('http://127.0.0.1:8002')
    end

    it '明示された localhost:8000 をそのまま返す' do
      expect(described_class.normalized_endpoint('http://localhost:8000')).to eq('http://localhost:8000')
    end

    it '明示された 127.0.0.1:8000 をそのまま返す' do
      expect(described_class.normalized_endpoint('http://127.0.0.1:8000')).to eq('http://127.0.0.1:8000')
    end

    it '空文字列の場合はテスト用の既定エンドポイントを返す' do
      expect(described_class.normalized_endpoint('')).to eq('http://127.0.0.1:8002')
    end
  end
end
