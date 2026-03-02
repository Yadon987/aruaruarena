# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe OpenAiAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }
  it_behaves_like 'base ai adapter inheritance'

  # 何を検証するか: 定数の定義
  describe '定数' do
    it_behaves_like 'adapter constants',
                    {
                      PROMPT_PATH: 'app/prompts/nakao.txt',
                      BASE_URL: 'https://api.groq.com/openai/v1',
                      MODEL_NAME: 'llama-3.3-70b-versatile'
                    }
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    it_behaves_like 'adapter initialization', '中尾彬風'
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    let(:adapter) { described_class.new }
    it_behaves_like 'openai compatible client', 'https://api.groq.com/openai/v1'
  end

  # 何を検証するか: リクエストの構築
  describe '#build_request' do
    let(:adapter) { described_class.new }
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'nakao' }

    it_behaves_like 'openai compatible build request', 'llama-3.3-70b-versatile', 'nakao'

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
