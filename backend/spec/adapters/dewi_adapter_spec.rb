# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

# Issue: E06-05
RSpec.describe DewiAdapter, type: :model do
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
    context '正常系' do
      it '有効なスコア（0-20）を受け付けること' do
        # GREENフェーズで実装後に検証可能
        skip 'DewiAdapterのparse_responseメソッド実装後に有効化'
      end
    end

    context '異常系' do
      it '無効なスコア（範囲外）は拒否されること' do
        skip 'DewiAdapterのparse_responseメソッド実装後に有効化'
      end
    end
  end
end
