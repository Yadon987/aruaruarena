# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

# Issue: E06-05
RSpec.describe DewiAdapter, type: :model do
  # 各テスト前にプロンプトキャッシュをリセット
  before(:each) do
    described_class.reset_prompt_cache! if defined?(described_class.reset_prompt_cache!)
  end

  let(:adapter) { described_class.new }
  # 何を検証するか: BaseAiAdapterを継承していること
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: 定数の定義
  # 定数の定義
  describe '定数' do
    it 'PROMPT_PATH定数が正しく定義されていること' do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/dewi.txt')
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    it_behaves_like 'adapter initialization', 'デヴィ婦人風'
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    it 'Faraday::Connectionインスタンスを返すこと' do
      adapter = described_class.new
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    it 'GLM APIのベースURLが設定されていること' do
      adapter = described_class.new
      client = adapter.send(:client)
      expect(client.url_prefix.to_s).to include('open.bigmodel.cn')
    end
  end

  # 何を検証するか: APIキーの取得
  it_behaves_like 'adapter api key validation', 'GLM_API_KEY'

  # 何を検証するか: リクエストの構築
  describe '#build_request' do
    let(:adapter) { described_class.new }
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'dewi' }

    it 'リクエストボディが正しく構築されること' do
      request = adapter.send(:build_request, post_content, persona)
      expect(request[:model]).to eq('glm-4-flash')
      expect(request[:messages]).to be_a(Array)
      expect(request[:messages].first[:content]).to include('テスト投稿')
    end

    it 'temperatureとmax_tokensが設定されていること' do
      request = adapter.send(:build_request, post_content, persona)
      expect(request[:temperature]).to eq(0.7)
      expect(request[:max_tokens]).to eq(1000)
    end
  end

  # 何を検証するか: スコアバリデーション
  describe '#parse_response' do
    let(:adapter) { described_class.new }
    it_behaves_like 'openai style parse response'
  end

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
