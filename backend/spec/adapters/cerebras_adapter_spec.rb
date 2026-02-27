# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CerebrasAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }

  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  describe '定数' do
    it '必要な定数が正しく定義されていること', :aggregate_failures do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/dewi.txt')
      expect(described_class::BASE_URL).to eq('https://api.cerebras.ai/v1')
      expect(described_class::MODEL_NAME).to eq('gpt-oss-120b')
    end
  end

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }

    it 'OpenAI互換のリクエスト形式であること' do
      request = adapter.send(:build_request, post_content, 'dewi')

      expect(request[:model]).to eq('gpt-oss-120b')
      expect(request[:messages]).to be_present
      expect(request[:messages].first[:content]).to include(post_content)
      expect(request[:temperature]).to eq(0.7)
      expect(request[:max_tokens]).to eq(1000)
    end
  end

  describe '#parse_response' do
    it_behaves_like 'openai style parse response'
  end

  it_behaves_like 'adapter api key validation', 'CEREBRAS_API_KEY'
end
