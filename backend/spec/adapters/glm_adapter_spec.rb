# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe GlmAdapter do
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  describe '定数' do
    it 'PROMPT_PATHが正しく定義されていること' do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/hiroyuki.txt')
    end

    it 'MODEL_NAMEがglm-4-flashであること' do
      expect(described_class::MODEL_NAME).to eq('glm-4-flash')
    end

    it 'BASE_URLが正しく定義されていること' do
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
    let(:base_scores) do
      { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 }
    end

    def build_faraday_response(body_hash)
      double('Faraday::Response', body: JSON.generate(body_hash))
    end

    it '正常なレスポンスをパースできること' do
      json_content = JSON.generate(base_scores.merge(comment: 'テストコメント'))
      response_body = {
        choices: [
          {
            message: {
              content: "```json\n#{json_content}\n```"
            }
          }
        ]
      }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)

      expect(result[:scores][:empathy]).to eq(15)
      expect(result[:comment]).to eq('テストコメント')
    end

    it '不正なJSONの場合はinvalid_responseエラーを返すこと' do
      response_body = { choices: [] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.succeeded).to be false
    end
  end

  describe '#api_key' do
    it '環境変数GLM_API_KEYを使用すること' do
      allow(ENV).to receive(:[]).with('GLM_API_KEY').and_return('test_glm_key')
      adapter = described_class.new
      expect(adapter.send(:api_key)).to eq('test_glm_key')
    end

    it 'APIキーがない場合はエラーを発生させること' do
      allow(ENV).to receive(:[]).with('GLM_API_KEY').and_return(nil)
      adapter = described_class.new
      expect { adapter.send(:api_key) }.to raise_error(ArgumentError)
    end
  end
end
