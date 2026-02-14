# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

# Issue: E06-05
RSpec.describe DewiAdapter, type: :model do
  # 各テスト前にプロンプトキャッシュをリセット
  before(:each) do
    described_class.reset_prompt_cache! if defined?(described_class.reset_prompt_cache!)
  end
  # 何を検証するか: BaseAiAdapterを継承していること
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: 定数の定義
  describe '定数' do
    it 'PROMPT_PATH定数が定義されていること' do
      expect(described_class::PROMPT_PATH).to be_a(String)
    end

    it 'PROMPT_PATH定数が正しいパスを返すこと' do
      expected_path = Rails.root.join('app/prompts/dewi.txt').to_s
      expect(described_class::PROMPT_PATH).to eq(expected_path)
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    context '正常系' do
      it 'プロンプトファイルを読み込むこと' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('あなたは「デヴィ婦人風」')
      end

      it 'プロンプトに{post_content}プレースホルダーが含まれること' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('{post_content}')
      end

      it 'プロンプトファイルがキャッシュされること' do
        adapter1 = described_class.new
        adapter2 = described_class.new

        expect(adapter1.instance_variable_get(:@prompt)).to eq(adapter2.instance_variable_get(:@prompt))
      end
    end

    context '異常系' do
      before do
        described_class.reset_prompt_cache!
      end

      it 'プロンプトファイルが存在しない場合は例外を発生させること' do
        allow(File).to receive(:exist?).and_call_original
        allow(File).to receive(:exist?).with(described_class::PROMPT_PATH).and_return(false)

        expect do
          described_class.new
        end.to raise_error(ArgumentError, /プロンプトファイルが見つかりません/)
      end
    end
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
  describe '#api_key' do
    context '正常系' do
      before do
        stub_env('GLM_API_KEY', 'test_api_key')
      end

      it 'GLM_API_KEY環境変数を返すこと' do
        adapter = described_class.new
        expect(adapter.send(:api_key)).to eq('test_api_key')
      end
    end

    context '異常系' do
      before do
        stub_env('GLM_API_KEY', nil)
      end

      it 'GLM_API_KEYが設定されていない場合は例外を発生させること' do
        adapter = described_class.new
        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, 'GLM_API_KEYが設定されていません')
      end
    end
  end

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
  describe 'スコアバリデーション' do
    let(:adapter) { described_class.new }

    def build_faraday_response(body_hash)
      double('Faraday::Response', body: body_hash)
    end

    context '正常系' do
      it '有効なスコア（0-20）を受け付けること' do
        # GlmAdapterと同様にparse_responseのテストを追加
        response_body = {
          choices: [
            {
              message: {
                content: JSON.generate({ empathy: 15, humor: 10, brevity: 20, originality: 5, expression: 12,
                                         comment: '良い投稿です' })
              }
            }
          ]
        }
        resp = build_faraday_response(response_body)

        result = adapter.send(:parse_response, resp)

        expect(result).to be_a(Hash)
        expect(result[:scores][:empathy]).to eq(15)
        expect(result[:scores][:humor]).to eq(10)
        expect(result[:scores][:brevity]).to eq(20)
        expect(result[:scores][:originality]).to eq(5)
        expect(result[:scores][:expression]).to eq(12)
        expect(result[:comment]).to eq('良い投稿です')
      end
    end

    context '異常系' do
      it '範囲外のスコアもパースできること（親クラスでバリデーション）' do
        # 範囲外のスコア（21）を持つレスポンス
        # 親クラスのBaseAiAdapter#call_ai_apiで範囲チェックされる
        response_body = {
          choices: [
            {
              message: {
                content: JSON.generate({ empathy: 15, humor: 21, brevity: 20, originality: 5, expression: 12,
                                         comment: 'スコア超過' })
              }
            }
          ]
        }
        resp = build_faraday_response(response_body)

        result = adapter.send(:parse_response, resp)

        # parse_response自体はHashを返す（親クラスでJudgmentResultに変換される）
        expect(result).to be_a(Hash)
        expect(result[:scores][:humor]).to eq(21)
        expect(result[:comment]).to eq('スコア超過')
      end
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
