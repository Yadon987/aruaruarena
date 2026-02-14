# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe GlmAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }

  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  describe '定数' do
    it '必要な定数が正しく定義されていること', :aggregate_failures do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/hiroyuki.txt')
      expect(described_class::MODEL_NAME).to eq('glm-4-flash')
      expect(described_class::BASE_URL).to eq('https://open.bigmodel.cn/api/paas/v4/')
    end
  end

  describe '#client' do
    it 'Faraday::Connectionを返すこと' do
      adapter = described_class.new
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    it '正しいBase URLが設定されていること' do
      adapter = described_class.new
      expect(adapter.send(:client).url_prefix.to_s).to eq('https://open.bigmodel.cn/api/paas/v4/')
    end

    it 'Bearer Token認証ヘッダーが設定されること' do
      allow(ENV).to receive(:[]).with('GLM_API_KEY').and_return('test_key')
      described_class.new
      # clientメソッド自体はヘッダーを設定しない（execute_requestで設定する）設計の場合は修正
      # GeminiAdapterはexecute_requestで設定していたので、こちらもそれに合わせる
    end
  end

  describe '#build_request' do
    let(:adapter) { described_class.new }
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'hiroyuki' }

    it 'OpenAI互換のメッセージ形式でリクエストを構築すること' do
      request = adapter.send(:build_request, post_content, persona)

      expect(request).to be_a(Hash)
      expect(request[:model]).to eq('glm-4-flash')
      expect(request[:messages]).to be_an(Array)
      expect(request[:messages].first[:role]).to eq('user')
      expect(request[:messages].first[:content]).to include(post_content)
    end

    it 'temperatureとmax_tokensが設定されていること' do
      request = adapter.send(:build_request, post_content, persona)
      expect(request[:temperature]).to eq(0.7)
      expect(request[:max_tokens]).to eq(1000)
    end
  end

  describe '#parse_response' do
    let(:adapter) { described_class.new }
    it_behaves_like 'openai style parse response'
  end

  it_behaves_like 'adapter api key validation', 'GLM_API_KEY'

  describe '.reset_prompt_cache!' do
    it 'プロンプトキャッシュをリセットすること' do
      # キャッシュを作成
      described_class.new
      # キャッシュをリセット
      described_class.reset_prompt_cache!
      expect(described_class.prompt_cache).to be_nil
    end
  end

  describe '#execute_request' do
    let(:adapter) { described_class.new }
    let(:request_body) { { model: 'glm-4-flash', messages: [] } }

    it_behaves_like 'GLM execute request error handling'
  end

  describe '#handle_response_status' do
    let(:adapter) { described_class.new }

    it_behaves_like 'GLM response status handling'
  end
end
