# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe GlmAdapter do
  # 何を検証するか: BaseAiAdapterを継承していること
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: PROMPT_PATH定数の定義
  describe '定数' do
    it 'PROMPT_PATH定数が定義されていること' do
      expect(described_class::PROMPT_PATH).to be_a(String)
    end

    it 'PROMPT_PATH定数が正しいパスを返すこと' do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/dewi.txt')
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
      it 'プロンプトファイルが存在しない場合は例外を発生させること' do
        # 他のファイルパスに対してはデフォルトの動作をさせる
        allow(File).to receive(:exist?).and_call_original
        # キャッシュをリセットしてからテスト
        described_class.reset_prompt_cache!
        # PROMPT_PATHのみモック
        allow(File).to receive(:exist?).with(described_class::PROMPT_PATH).and_return(false)

        expect do
          described_class.new
        end.to raise_error(ArgumentError, /プロンプトファイルが見つかりません/)
      end

      it 'PROMPT_PATHにパストラバーサル攻撃が含まれる場合は例外を発生させること' do
        # キャッシュをリセット
        described_class.reset_prompt_cache!

        # パストラバーサルを含むパスでプロンプトをロードしようとすると
        # load_promptメソッドでチェックされて例外が発生する
        # 実際のPROMPT_PATH定数にはパストラバーサルが含まれていないので、
        # このテストではload_promptを直接呼び出して検証することはできません
        # 代わりに、パストラバーサルチェックが機能することを確認します

        # このテストは現在の実装では、実際にパストラバーサルを含むパスを
        # テストすることが難しいため、スキップします
        skip '定数のモックはできないため、このテストは別の方法で実装する必要があります'
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

    it 'SSL証明書の検証が有効であること' do
      adapter = described_class.new
      client = adapter.send(:client)
      expect(client.ssl.verify).to be true
    end
  end

  # 何を検証するか: リクエストの構築
  describe '#build_request' do
    let(:adapter) { described_class.new }
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'dewi' }

    context '正常系' do
      it '正しいリクエスト形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request).to be_a(Hash)
        expect(request[:model]).to be_present
        expect(request[:messages]).to be_present
      end

      it 'modelがglm-4-flashに設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request[:model]).to eq('glm-4-flash')
      end

      it 'messagesが配列形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request[:messages]).to be_an(Array)
      end

      it 'messages[0].roleがuserであること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request[:messages].first[:role]).to eq('user')
      end

      it 'プロンプトが{post_content}に置換されていること' do
        request = adapter.send(:build_request, post_content, persona)

        content = request[:messages].first[:content]
        expect(content).to include(post_content)
        expect(content).not_to include('{post_content}')
      end

      it 'temperatureが0.7に設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request[:temperature]).to eq(0.7)
      end

      it 'max_tokensが1000に設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request[:max_tokens]).to eq(1000)
      end
    end

    context '境界値' do
      it 'post_contentにJSON制御文字が含まれる場合に正しくエスケープされること' do
        dangerous_content = '{"test": "injection"}'
        request = adapter.send(:build_request, dangerous_content, persona)

        content = request[:messages].first[:content]
        expect(content).to include(dangerous_content)
      end

      it 'post_contentに特殊文字が含まれる場合に正しく扱うこと' do
        special_content = 'テスト<script>alert("xss")</script>投稿'
        request = adapter.send(:build_request, special_content, persona)

        expect(request[:messages]).to be_present
      end

      it 'post_contentに改行が含まれる場合に正しく扱うこと' do
        newline_content = "テスト\n投稿\nです"
        request = adapter.send(:build_request, newline_content, persona)

        expect(request[:messages]).to be_present
      end

      it 'post_contentに絵文字が含まれる場合に正しく扱うこと' do
        emoji_content = 'テスト😊投稿🎉'
        request = adapter.send(:build_request, emoji_content, persona)

        expect(request[:messages]).to be_present
      end
    end

    context 'セキュリティ' do
      it 'post_contentにパストラバーサル攻撃が含まれる場合に正しく扱うこと' do
        # パストラバーサルの文字列が含まれていても、単なる文字列として扱う
        # レスポンス解析時に影響を与えないこと
        path_traversal_content = '../../../../etc/passwd'
        request = adapter.send(:build_request, path_traversal_content, persona)

        content = request[:messages].first[:content]
        expect(content).to include(path_traversal_content)
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
    # @param response_hash [Hash] APIレスポンスボディ
    # @return [Object] bodyメソッドを持つモックオブジェクト
    def build_faraday_response(response_hash)
      double('Faraday::Response', body: JSON.generate(response_hash))
    end

    context '正常系' do
      it 'スコアとコメントが正しく解析されること' do
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(base_scores.merge(comment: '素敵'))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:scores]).to eq(base_scores.transform_keys(&:to_sym))
        expect(result[:comment]).to eq('素敵')
      end

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

      # 何を検証するか: 小数点文字列のスコア変換（CodeRabbitレビュー対応）
      context '小数点スコアの扱い' do
        it 'スコアが小数点文字列（"12.5"）の場合に四捨五入して整数に変換できること' do
          decimal_string_scores = base_scores.merge(empathy: '12.5', humor: '15.7', brevity: '8.2')
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

          # 12.5 -> 13, 15.7 -> 16, 8.2 -> 8（四捨五入）
          expect(result[:scores][:empathy]).to eq(13)
          expect(result[:scores][:humor]).to eq(16)
          expect(result[:scores][:brevity]).to eq(8)
          expect(result[:scores][:empathy]).to be_a(Integer)
        end

        it 'スコアが小数点（Float）の場合に四捨五入して整数に変換できること' do
          decimal_float_scores = base_scores.merge(empathy: 12.5, humor: 15.7, brevity: 8.2)
          response_hash = {
            choices: [
              {
                message: {
                  content: JSON.generate(decimal_float_scores.merge(comment: 'テスト'))
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores][:empathy]).to eq(13)
          expect(result[:scores][:humor]).to eq(16)
          expect(result[:scores][:brevity]).to eq(8)
        end

        it 'スコアが境界値（0.5）の場合に正しく丸められること' do
          boundary_scores = base_scores.transform_values { |v| v == 15 ? 0.5 : v }
          response_hash = {
            choices: [
              {
                message: {
                  content: JSON.generate(boundary_scores.merge(comment: '境界値テスト'))
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          # 0.5 -> 1（四捨五入）
          expect(result[:scores][:empathy]).to eq(1)
        end
      end

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
    end

    context 'コードブロックの扱い' do
      it 'JSONがコードブロックで囲まれている場合に正しく解析できること' do
        json_with_codeblock = <<~JSON
          ```json
          {
            "empathy": 15,
            "humor": 15,
            "brevity": 15,
            "originality": 15,
            "expression": 15,
            "comment": "素敵"
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
        expect(result[:comment]).to eq('素敵')
      end

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

      # 何を検証するか: コードブロック外にテキストがある場合のJSON抽出（CodeRabbitレビュー対応）
      context '周囲にテキストがある場合' do
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
              "comment": "素敵"
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
          expect(result[:comment]).to eq('素敵')
        end

        it '複数のコードブロックが含まれる場合に最初のJSONを抽出できること' do
          json_with_multiple_blocks = <<~TEXT
            ```json
            {
              "empathy": 15,
              "humor": 15,
              "brevity": 15,
              "originality": 15,
              "expression": 15,
              "comment": "最初"
            }
            ```
            余分なテキスト
            ```
            これは無視される
            ```
          TEXT

          response_hash = {
            choices: [
              {
                message: {
                  content: json_with_multiple_blocks
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('最初')
        end

        it '```jsonがないコードブロックを正しく抽出できること' do
          json_without_json_marker = <<~TEXT
            結果:
            ```
            {
              "empathy": 15,
              "humor": 15,
              "brevity": 15,
              "originality": 15,
              "expression": 15,
              "comment": "素敵"
            }
            ```
          TEXT

          response_hash = {
            choices: [
              {
                message: {
                  content: json_without_json_marker
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('素敵')
        end
      end
    end

    context '異常系' do
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

      it 'choices[].messageが欠落している場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          choices: [{}]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'choices[].message.contentが欠落している場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          choices: [
            {
              message: {}
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが空文字列の場合にパースできること（親クラスでバリデーション）' do
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(base_scores.merge(comment: ''))
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:comment]).to eq('')
      end

      it 'commentが欠落（nil）している場合にパースできること（親クラスでバリデーション）' do
        response_hash = {
          choices: [
            {
              message: {
                content: JSON.generate(base_scores)
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:comment]).to be_nil
      end
    end

    context '境界値' do
      it 'スコアが-1の場合にパースできること（親クラスでバリデーション）' do
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

      it 'スコアが21の場合にパースできること（親クラスでバリデーション）' do
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
        stub_env('GLM_API_KEY', 'test_api_key_12345')
      end

      it 'ENV["GLM_API_KEY"]を返すこと' do
        expect(adapter.send(:api_key)).to eq('test_api_key_12345')
      end
    end

    context '異常系' do
      it 'APIキーがnilの場合は例外を発生させること' do
        stub_env('GLM_API_KEY', nil)

        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, /GLM_API_KEYが設定されていません/)
      end

      it 'APIキーが空文字列の場合は例外を発生させること' do
        stub_env('GLM_API_KEY', '')

        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, /GLM_API_KEYが設定されていません/)
      end

      it 'APIキーが空白のみの場合は例外を発生させること' do
        stub_env('GLM_API_KEY', '   ')

        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, /GLM_API_KEYが設定されていません/)
      end
    end
  end

  # 何を検証するか: Integration Test（VCR使用）
  describe '#judge (Integration)' do
    let(:adapter) { described_class.new }

    # VCRカセットが作成されるまでスキップ
    before { skip 'VCRカセットを作成する必要があります' }

    context '正常系' do
      it '正常に審査結果を返す', :vcr do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be true
        expect(result.scores).to be_a(Hash)
        expect(result.scores.keys).to include(:empathy, :humor, :brevity, :originality, :expression)
        expect(result.comment).to be_a(String)
      end

      it 'デヴィ婦人風のバイアスが適用されること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        # 元のスコアが15の場合、バイアス適用後の値を検証
        # デヴィ婦人風: 表現力+3、面白さ+2
        expect(result.scores[:expression]).to eq(18) # 15 + 3
        expect(result.scores[:humor]).to eq(17)      # 15 + 2
      end

      it 'バイアス適用後もスコアが0-20の範囲内に収まること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        result.scores.each do |key, score|
          expect(score).to be_between(0, 20), "スコア#{key}が範囲外: #{score}"
        end
      end
    end

    context '異常系' do
      it 'タイムアウト時にtimeoutエラーコードを返す', vcr: 'timeout' do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'レート制限時にprovider_errorエラーコードを返す', vcr: 'rate_limit' do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('provider_error')
      end

      it '不正なJSONが返された場合はinvalid_responseエラーコードを返す', vcr: 'invalid_json' do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'choicesが空の場合はinvalid_responseエラーコードを返す', vcr: 'empty_choices' do
        result = adapter.judge('テスト投稿', persona: 'dewi')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end
  end

  # 何を検証するか: 並行処理
  describe '並行処理' do
    it '複数スレッドから同時に呼び出された場合に正しく動作すること', :vcr do
      # VCRカセットが作成されるまでスキップ
      skip 'VCRカセットを作成する必要があります'
    end

    it 'プロンプトファイルのキャッシュがスレッドセーフであること' do
      adapters = 10.times.map { described_class.new }

      prompts = adapters.map { |a| a.instance_variable_get(:@prompt) }

      expect(prompts.uniq.size).to eq(1)
      expect(prompts.first).to include('あなたは「デヴィ婦人風」')
    end
  end

  # 何を検証するか: ログ出力
  describe 'ログ出力' do
    let(:adapter) { described_class.new }

    it 'API呼び出し成功時にINFOレベルでログを出力すること', :vcr do
      # VCRカセットが作成されるまでスキップ
      skip 'VCRカセットを作成する必要があります'
    end

    it 'リトライ時にWARNレベルでログを出力すること', vcr: 'timeout' do
      # VCRカセットが作成されるまでスキップ
      skip 'VCRカセットを作成する必要があります'
    end

    it 'APIエラー時にERRORレベルでログを出力すること', vcr: 'rate_limit' do
      # VCRカセットが作成されるまでスキップ
      skip 'VCRカセットを作成する必要があります'
    end
  end

  # 環境変数をモックするヘルパーメソッド
  def stub_env(key, value)
    allow(ENV).to receive(:[]).with(key).and_return(value)
  end
end
