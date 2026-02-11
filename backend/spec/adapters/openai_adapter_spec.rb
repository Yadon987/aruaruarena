# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe OpenAiAdapter do
  # 何を検証するか: BaseAiAdapterを継承していること
  # 失敗理由: OpenAIAdapterクラスがまだ存在しないため
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: 定数の定義
  describe '定数' do
    # 何を検証するか: PROMPT_PATH定数が定義されていること
    # 失敗理由: PROMPT_PATH定数がまだ定義されていないため
    it 'PROMPT_PATH定数が定義されていること' do
      expect(described_class::PROMPT_PATH).to be_a(String)
    end

    # 何を検証するか: PROMPT_PATH定数が正しいパスを返すこと
    # 失敗理由: PROMPT_PATH定数がまだ定義されていないため
    it 'PROMPT_PATH定数が正しいパスを返すこと' do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/nakao.txt')
    end

    # 何を検証するか: BASE_URL定数が定義されていること
    # 失敗理由: BASE_URL定数がまだ定義されていないため
    it 'BASE_URL定数が定義されていること' do
      expect(described_class::BASE_URL).to eq('https://api.openai.com')
    end

    # 何を検証するか: MODEL_NAME定数がgpt-4o-miniであること
    # 失敗理由: MODEL_NAME定数がまだ定義されていないため
    it 'MODEL_NAME定数がgpt-4o-miniであること' do
      expect(described_class::MODEL_NAME).to eq('gpt-4o-mini')
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    context '正常系' do
      # 何を検証するか: プロンプトファイルを読み込むこと
      # 失敗理由: initializeメソッドがまだ実装されていないため
      it 'プロンプトファイルを読み込むこと' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('あなたは「中尾彬風」')
      end

      # 何を検証するか: プロンプトに{post_content}プレースホルダーが含まれること
      # 失敗理由: initializeメソッドがまだ実装されていないため
      it 'プロンプトに{post_content}プレースホルダーが含まれること' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('{post_content}')
      end

      # 何を検証するか: プロンプトファイルがキャッシュされること
      # 失敗理由: プロンプトキャッシュ機能がまだ実装されていないため
      it 'プロンプトファイルがキャッシュされること' do
        adapter1 = described_class.new
        adapter2 = described_class.new

        expect(adapter1.instance_variable_get(:@prompt)).to eq(adapter2.instance_variable_get(:@prompt))
      end
    end

    context '異常系' do
      # 何を検証するか: プロンプトファイルが存在しない場合は例外を発生させること
      # 失敗理由: プロンプトファイル存在チェックがまだ実装されていないため
      it 'プロンプトファイルが存在しない場合は例外を発生させること' do
        allow(File).to receive(:exist?).and_call_original
        described_class.reset_prompt_cache! if described_class.respond_to?(:reset_prompt_cache!)
        allow(File).to receive(:exist?).with(described_class::PROMPT_PATH).and_return(false)

        expect do
          described_class.new
        end.to raise_error(ArgumentError, /プロンプトファイルが見つかりません/)
      end
    end
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    let(:adapter) { described_class.new }

    # 何を検証するか: Faraday::Connectionインスタンスを返すこと
    # 失敗理由: clientメソッドがまだ実装されていないため
    it 'Faraday::Connectionインスタンスを返すこと' do
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    # 何を検証するか: OpenAI APIのベースURLが設定されていること
    # 失敗理由: clientメソッドがまだ実装されていないため
    it 'OpenAI APIのベースURLが設定されていること' do
      client = adapter.send(:client)
      expect(client.url_prefix.to_s).to include('api.openai.com')
    end

    # 何を検証するか: SSL証明書の検証が有効であること
    # 失敗理由: clientメソッドがまだ実装されていないため
    it 'SSL証明書の検証が有効であること' do
      client = adapter.send(:client)
      expect(client.ssl.verify).to be true
    end

    # 何を検証するか: タイムアウトが30秒に設定されていること
    # 失敗理由: タイムアウト設定がまだ実装されていないため
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
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it '正しいリクエスト形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request).to be_a(Hash)
        expect(request[:model]).to eq('gpt-4o-mini')
        expect(request[:messages]).to be_present
      end

      # 何を検証するか: プロンプトが{post_content}に置換されていること
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'プロンプトが{post_content}に置換されていること' do
        request = adapter.send(:build_request, post_content, persona)

        user_content = request[:messages].first[:content]
        expect(user_content).to include(post_content)
        expect(user_content).not_to include('{post_content}')
      end

      # 何を検証するか: modelがgpt-4o-miniに設定されていること
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'modelがgpt-4o-miniに設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:model]).to eq('gpt-4o-mini')
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

    context '境界値' do
      # 何を検証するか: post_contentにJSON制御文字が含まれる場合に正しくエスケープされること
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentにJSON制御文字が含まれる場合に正しくエスケープされること' do
        dangerous_content = '{"test": "injection"}'
        request = adapter.send(:build_request, dangerous_content, persona)

        user_content = request[:messages].first[:content]
        expect(user_content).to include(dangerous_content)
      end

      # 何を検証するか: post_contentに特殊文字が含まれる場合に正しく扱うこと
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentに特殊文字が含まれる場合に正しく扱うこと' do
        special_content = 'テスト<script>alert("xss")</script>投稿'
        request = adapter.send(:build_request, special_content, persona)

        expect(request[:messages]).to be_present
      end

      # 何を検証するか: post_contentに改行が含まれる場合に正しく扱うこと
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentに改行が含まれる場合に正しく扱うこと' do
        newline_content = "テスト\n投稿\nです"
        request = adapter.send(:build_request, newline_content, persona)

        expect(request[:messages]).to be_present
      end

      # 何を検証するか: post_contentに絵文字が含まれる場合に正しく扱うこと
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentに絵文字が含まれる場合に正しく扱うこと' do
        emoji_content = 'テスト😊投稿🎉'
        request = adapter.send(:build_request, emoji_content, persona)

        expect(request[:messages]).to be_present
      end
    end
  end

  # 何を検証するか: レスポンスの解析
  describe '#parse_response' do
    let(:adapter) { described_class.new }
    let(:base_scores) do
      {
        empathy: 15,
        humor: 15,
        brevity: 15,
        originality: 15,
        expression: 15
      }
    end

    # Faraday::Responseライクなモックを作成するヘルパー
    def build_faraday_response(response_hash)
      double('Faraday::Response', body: JSON.generate(response_hash))
    end

    context '正常系' do
      # 何を検証するか: スコアとコメントが正しく解析されること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアとコメントが正しく解析されること' do
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(base_scores.merge(comment: 'うん、いいねぇ'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:scores]).to eq(base_scores.transform_keys(&:to_sym))
        expect(result[:comment]).to eq('うん、いいねぇ')
      end

      # 何を検証するか: スコアが文字列の場合に整数に変換できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが文字列の場合に整数に変換できること' do
        string_scores = base_scores.transform_values(&:to_s)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(string_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(15)
        expect(result[:scores][:empathy]).to be_a(Integer)
      end

      # 何を検証するか: スコアが浮動小数点数の場合に整数に変換できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが浮動小数点数の場合に整数に変換できること' do
        float_scores = base_scores.transform_values(&:to_f)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(float_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(15)
        expect(result[:scores][:empathy]).to be_a(Integer)
      end

      # 何を検証するか: スコアが0の場合は有効と判定されること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが0の場合は有効と判定されること' do
        zero_scores = base_scores.transform_values { 0 }
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(zero_scores.merge(comment: '最低点'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(0)
      end

      # 何を検証するか: スコアが20の場合は有効と判定されること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが20の場合は有効と判定されること' do
        max_scores = base_scores.transform_values { 20 }
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(max_scores.merge(comment: '満点'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(20)
      end

      # 何を検証するか: スコアが小数点文字列（"12.5"）の場合に四捨五入して整数に変換できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが小数点文字列（"12.5"）の場合に四捨五入して整数に変換できること' do
        decimal_string_scores = base_scores.merge(empathy: "12.5", humor: "15.7", brevity: "8.2")
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(decimal_string_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(13)  # 12.5 -> 13
        expect(result[:scores][:humor]).to eq(16)    # 15.7 -> 16
        expect(result[:scores][:brevity]).to eq(8)   # 8.2 -> 8
      end

      # 何を検証するか: スコアが小数点（Float）の場合に四捨五入して整数に変換できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが小数点（Float）の場合に四捨五入して整数に変換できること' do
        float_scores = base_scores.merge(empathy: 12.5, humor: 15.7, brevity: 8.2)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(float_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(13)  # 12.5 -> 13
        expect(result[:scores][:humor]).to eq(16)    # 15.7 -> 16
        expect(result[:scores][:brevity]).to eq(8)   # 8.2 -> 8
      end

      # 何を検証するか: スコアが境界値（0.5）の場合に正しく丸められること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが境界値（0.5）の場合に正しく丸められること' do
        boundary_scores = base_scores.merge(empathy: 0.5, humor: 1.5)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(boundary_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores][:empathy]).to eq(1)  # 0.5 -> 1（四捨五入）
        expect(result[:scores][:humor]).to eq(2)    # 1.5 -> 2（四捨五入）
      end
    end

    context 'コードブロックの扱い' do
      # 何を検証するか: JSONがコードブロックで囲まれている場合に正しく解析できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'JSONがコードブロックで囲まれている場合に正しく解析できること' do
        json_with_codeblock = <<~JSON
          ```json
          {
            "empathy": 15,
            "humor": 15,
            "brevity": 15,
            "originality": 15,
            "expression": 15,
            "comment": "うん、いいねぇ"
          }
          ```
        JSON

        response_hash = {
          choices: [
            {
              message: {
                content: json_with_codeblock
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to be_present
        expect(result[:comment]).to eq('うん、いいねぇ')
      end

      # 何を検証するか: JSONがmarkdownのコードブロックで囲まれている場合に解析できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'JSONがmarkdownのコードブロックで囲まれている場合に解析できること' do
        json_with_markdown = "```json\n#{JSON.generate(base_scores.merge(comment: 'テスト'))}\n```"

        response_hash = {
          choices: [
            {
              message: {
                content: json_with_markdown
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to be_present
      end

      # 何を検証するか: JSONが前後にテキストを含むコードブロックで囲まれている場合に正しく抽出できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'JSONが前後にテキストを含むコードブロックで囲まれている場合に正しく抽出できること' do
        json_with_surrounding_text = <<~TEXT
          これは審査結果です:
          ```json
          {
            "empathy": 15,
            "humor": 15,
            "brevity": 15,
            "originality": 15,
            "expression": 15,
            "comment": "うん、いいねぇ"
          }
          ```
          以上です。
        TEXT

        response_hash = {
          choices: [
            {
              message: {
                content: json_with_surrounding_text
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to be_present
        expect(result[:comment]).to eq('うん、いいねぇ')
      end

      # 何を検証するか: 複数のコードブロックが含まれる場合に最初のJSONを抽出できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it '複数のコードブロックが含まれる場合に最初のJSONを抽出できること' do
        multi_codeblock = <<~TEXT
          参考:
          ```ruby
          def example
            "hello"
          end
          ```
          結果:
          ```json
          {
            "empathy": 15,
            "humor": 15,
            "brevity": 15,
            "originality": 15,
            "expression": 15,
            "comment": "テスト"
          }
          ```
        TEXT

        response_hash = {
          choices: [
            {
              message: {
                content: multi_codeblock
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to be_present
        expect(result[:comment]).to eq('テスト')
      end

      # 何を検証するか: ```jsonがないコードブロックを正しく抽出できること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it '```jsonがないコードブロックを正しく抽出できること' do
        simple_codeblock = <<~TEXT
          ```
          {
            "empathy": 15,
            "humor": 15,
            "brevity": 15,
            "originality": 15,
            "expression": 15,
            "comment": "テスト"
          }
          ```
        TEXT

        response_hash = {
          choices: [
            {
              message: {
                content: simple_codeblock
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to be_present
        expect(result[:comment]).to eq('テスト')
      end
    end

    context '異常系' do
      # 何を検証するか: JSONが不正な場合はinvalid_responseエラーコードを返すこと
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'JSONが不正な場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          choices: [
            {
              message: {
                content: 'invalid json{'
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      # 何を検証するか: スコアが欠落している場合はinvalid_responseエラーコードを返すこと
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが欠落している場合はinvalid_responseエラーコードを返すこと' do
        incomplete_scores = base_scores.except(:empathy)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(incomplete_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      # 何を検証するか: choicesが空の場合はinvalid_responseエラーコードを返すこと
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'choicesが空の場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          choices: []
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      # 何を検証するか: choicesがnilの場合はinvalid_responseエラーコードを返すこと
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'choicesがnilの場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          choices: nil
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end

    context '境界値' do
      # 何を検証するか: スコアが-1の場合は親クラスのバリデーションで検証されること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが-1の場合は親クラスのバリデーションで検証されること' do
        invalid_scores = base_scores.merge(empathy: -1)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(invalid_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:scores][:empathy]).to eq(-1)
      end

      # 何を検証するか: スコアが21の場合は親クラスのバリデーションで検証されること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが21の場合は親クラスのバリデーションで検証されること' do
        invalid_scores = base_scores.merge(empathy: 21)
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(invalid_scores.merge(comment: 'テスト'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:scores][:empathy]).to eq(21)
      end

      # 何を検証するか: commentが30文字を超える場合はtruncateされること
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'commentが30文字を超える場合はtruncateされること' do
        long_comment = 'a' * 35
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(base_scores.merge(comment: long_comment))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:comment].length).to eq(30)
      end

      # 何を検証するか: commentがちょうど30文字の場合はtruncateされないこと
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'commentがちょうど30文字の場合はtruncateされないこと' do
        exact_comment = 'a' * 30
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(base_scores.merge(comment: exact_comment))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:comment].length).to eq(30)
      end
    end
  end

  # 何を検証するか: APIキーの取得
  describe '#api_key' do
    let(:adapter) { described_class.new }

    context '正常系' do
      before do
        stub_env('OPENAI_API_KEY', 'test_api_key_12345')
      end

      # 何を検証するか: ENV["OPENAI_API_KEY"]を返すこと
      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'ENV["OPENAI_API_KEY"]を返すこと' do
        expect(adapter.send(:api_key)).to eq('test_api_key_12345')
      end
    end

    context '異常系' do
      # 何を検証するか: APIキーがnilの場合は例外を発生させること
      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'APIキーがnilの場合は例外を発生させること' do
        stub_env('OPENAI_API_KEY', nil)

        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, /OPENAI_API_KEYが設定されていません/)
      end

      # 何を検証するか: APIキーが空文字列の場合は例外を発生させること
      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'APIキーが空文字列の場合は例外を発生させること' do
        stub_env('OPENAI_API_KEY', '')

        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, /OPENAI_API_KEYが設定されていません/)
      end

      # 何を検証するか: APIキーが空白のみの場合は例外を発生させること
      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'APIキーが空白のみの場合は例外を発生させること' do
        stub_env('OPENAI_API_KEY', '   ')

        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, /OPENAI_API_KEYが設定されていません/)
      end
    end
  end

  # 何を検証するか: プロンプトキャッシュ機能
  describe 'プロンプトキャッシュ' do
    # 何を検証するか: プロンプトファイルのキャッシュが正しく動作すること
    # 失敗理由: プロンプトキャッシュ機能がまだ実装されていないため
    it 'プロンプトファイルのキャッシュが正しく動作すること' do
      adapters = 10.times.map { described_class.new }

      prompts = adapters.map { |a| a.instance_variable_get(:@prompt) }

      expect(prompts.uniq.size).to eq(1)
      expect(prompts.first).to include('あなたは「中尾彬風」')
    end
  end

  # 環境変数をモックするヘルパーメソッド
  def stub_env(key, value)
    allow(ENV).to receive(:[]).with(key).and_return(value)
  end
end
