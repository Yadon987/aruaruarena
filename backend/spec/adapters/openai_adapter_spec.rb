# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe OpenAiAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }
  # 何を検証するか: BaseAiAdapterを継承していること

  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: 定数の定義
  describe '定数' do
    it '必要な定数が正しく定義されていること', :aggregate_failures do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/nakao.txt')
      expect(described_class::BASE_URL).to eq('https://api.groq.com/openai/v1')
      expect(described_class::MODEL_NAME).to eq('llama-3.3-70b-versatile')
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    it_behaves_like 'adapter initialization', '中尾彬風'
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    let(:adapter) { described_class.new }

    # 何を検証するか: Faraday::Connectionインスタンスを返すこと

    it 'Faraday::Connectionインスタンスを返すこと' do
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    # 何を検証するか: Groq APIのベースURLが設定されていること

    it 'Groq APIのベースURLが設定されていること' do
      client = adapter.send(:client)
      expect(client.url_prefix.to_s).to include('api.groq.com/openai/v1')
    end

    # 何を検証するか: SSL証明書の検証が有効であること

    it 'SSL証明書の検証が有効であること' do
      client = adapter.send(:client)
      expect(client.ssl.verify).to be true
    end

    # 何を検証するか: タイムアウトが30秒に設定されていること

    it 'タイムアウトが30秒に設定されていること' do
      client = adapter.send(:client)
      expect(client.options.timeout).to eq(30)
    end
  end

  # 何を検証するか: リクエストの構築
  describe '#build_request' do
    let(:adapter) { described_class.new }
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'nakao' }

    context '正常系' do
      # 何を検証するか: 正しいリクエスト形式であること

      it '正しいリクエスト形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request).to be_a(Hash)
        expect(request[:model]).to eq('llama-3.3-70b-versatile')
        expect(request[:messages]).to be_present
      end

      # 何を検証するか: プロンプトが{post_content}に置換されていること

      it 'プロンプトが{post_content}に置換されていること' do
        request = adapter.send(:build_request, post_content, persona)

        user_content = request[:messages].first[:content]
        expect(user_content).to include(post_content)
        expect(user_content).not_to include('{post_content}')
      end

      # 何を検証するか: modelがllama-3.3-70b-versatileに設定されていること
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'modelがllama-3.3-70b-versatileに設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:model]).to eq('llama-3.3-70b-versatile')
      end

      # 何を検証するか: temperatureが0.7に設定されていること
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'temperatureが0.7に設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:temperature]).to eq(0.7)
      end

      # 何を検証するか: max_tokensが1000に設定されていること
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'max_tokensが1000に設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:max_tokens]).to eq(1000)
      end
    end

    it_behaves_like 'adapter build_request boundary', ->(req) { req[:messages].first[:content] }
  end

  # 何を検証するか: レスポンスの解析
  describe '#parse_response' do
    let(:adapter) { described_class.new }
    it_behaves_like 'openai style parse response'
  end

  # 何を検証するか: APIキーの取得
  it_behaves_like 'adapter api key validation', 'GROQ_API_KEY'
end
