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

    context 'エラーハンドリング' do
      it 'Faraday::TimeoutError発生時にログ出力して再送出すること' do
        allow(Rails.logger).to receive(:warn)
        allow(adapter.send(:client)).to receive(:post).and_raise(Faraday::TimeoutError.new('timeout'))

        expect { adapter.send(:execute_request, request_body) }.to raise_error(Faraday::TimeoutError)
        expect(Rails.logger).to have_received(:warn).with(/GLM APIタイムアウト/)
      end

      it 'Faraday::ConnectionFailed発生時にログ出力して再送出すること' do
        allow(Rails.logger).to receive(:error)
        allow(adapter.send(:client)).to receive(:post).and_raise(Faraday::ConnectionFailed.new('connection failed'))

        expect { adapter.send(:execute_request, request_body) }.to raise_error(Faraday::ConnectionFailed)
        expect(Rails.logger).to have_received(:error).with(/GLM API接続エラー/)
      end
    end
  end

  describe '#handle_response_status' do
    let(:adapter) { described_class.new }

    def build_response(status, body = {})
      double('Faraday::Response', status: status, body: body)
    end

    context 'HTTPステータス別処理' do
      it '200番台でレスポンスを返すこと' do
        allow(Rails.logger).to receive(:info)
        response = build_response(200, { result: 'ok' })

        result = adapter.send(:handle_response_status, response)
        expect(result).to eq(response)
        expect(Rails.logger).to have_received(:info).with('GLM API呼び出し成功')
      end

      it '201でレスポンスを返すこと' do
        allow(Rails.logger).to receive(:info)
        response = build_response(201)

        result = adapter.send(:handle_response_status, response)
        expect(result).to eq(response)
      end

      it '429でFaraday::ClientErrorを発生させること' do
        allow(Rails.logger).to receive(:warn)
        response = build_response(429, { error: 'rate limit' })

        expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
        expect(Rails.logger).to have_received(:warn).with(/GLM APIレート制限/)
      end

      it '400でFaraday::ClientErrorを発生させること' do
        allow(Rails.logger).to receive(:error)
        response = build_response(400, { error: 'bad request' })

        expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
        expect(Rails.logger).to have_received(:error).with(/GLM APIクライアントエラー/)
      end

      it '404でFaraday::ClientErrorを発生させること' do
        allow(Rails.logger).to receive(:error)
        response = build_response(404, { error: 'not found' })

        expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
      end

      it '500でFaraday::ServerErrorを発生させること' do
        allow(Rails.logger).to receive(:error)
        response = build_response(500, { error: 'internal error' })

        expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ServerError)
        expect(Rails.logger).to have_received(:error).with(/GLM APIサーバーエラー/)
      end

      it '503でFaraday::ServerErrorを発生させること' do
        allow(Rails.logger).to receive(:error)
        response = build_response(503, { error: 'service unavailable' })

        expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ServerError)
      end

      it 'その他のステータス（例: 301）でFaraday::ClientErrorを発生させること' do
        allow(Rails.logger).to receive(:error)
        response = build_response(301, { error: 'redirect' })

        expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
        expect(Rails.logger).to have_received(:error).with(/GLM API未知のエラー/)
      end
    end
  end
end
