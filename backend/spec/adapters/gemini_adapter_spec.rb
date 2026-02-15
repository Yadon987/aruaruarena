# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe GeminiAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }
  # 何を検証するか: BaseAiAdapterを継承していること
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: PROMPT_PATH定数の定義
  describe '定数' do
    it '必要な定数が正しく定義されていること', :aggregate_failures do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/hiroyuki.txt')
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    it_behaves_like 'adapter initialization', 'ひろゆき風'
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    it 'Faraday::Connectionインスタンスを返すこと' do
      adapter = described_class.new
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    it 'Gemini APIのベースURLが設定されていること' do
      adapter = described_class.new
      client = adapter.send(:client)
      expect(client.url_prefix.to_s).to include('generativelanguage.googleapis.com')
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
    let(:persona) { 'hiroyuki' }

    context '正常系' do
      it '正しいリクエスト形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request).to be_a(Hash)
        expect(request[:contents]).to be_present
        expect(request[:generationConfig]).to be_present
      end

      it 'プロンプトが{post_content}に置換されていること' do
        request = adapter.send(:build_request, post_content, persona)

        text_content = request[:contents].first[:parts].first[:text]
        expect(text_content).to include(post_content)
        expect(text_content).not_to include('{post_content}')
      end

      it 'generationConfigが正しく設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        config = request[:generationConfig]
        expect(config[:temperature]).to eq(0.7)
        expect(config[:maxOutputTokens]).to eq(1000)
      end
    end

    it_behaves_like 'adapter build_request boundary', ->(req) { req[:contents][0][:parts][0][:text] }

    context 'セキュリティ' do
      it 'post_contentにパストラバーサル攻撃が含まれる場合に正しく扱うこと' do
        # パストラバーサルの文字列が含まれていても、単なる文字列として扱う
        # レスポンス解析時に影響を与えないこと
        path_traversal_content = '../../../../etc/passwd'
        request = adapter.send(:build_request, path_traversal_content, persona)

        text_content = request[:contents].first[:parts].first[:text]
        expect(text_content).to include(path_traversal_content)
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

    context '正常系' do
      it 'スコアとコメントが正しく解析されること' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(base_scores.merge(comment: 'それって本当？')) }
                ]
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(Hash)
        expect(result[:scores]).to eq(base_scores.transform_keys(&:to_sym))
        expect(result[:comment]).to eq('それって本当？')
      end

      it 'スコアが文字列の場合に整数に変換できること' do
        string_scores = base_scores.transform_values(&:to_s)
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(string_scores.merge(comment: 'テスト')) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(float_scores.merge(comment: 'テスト')) }
                ]
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
            candidates: [
              {
                content: {
                  parts: [
                    { text: JSON.generate(decimal_string_scores.merge(comment: 'テスト')) }
                  ]
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
            candidates: [
              {
                content: {
                  parts: [
                    { text: JSON.generate(decimal_float_scores.merge(comment: 'テスト')) }
                  ]
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
            candidates: [
              {
                content: {
                  parts: [
                    { text: JSON.generate(boundary_scores.merge(comment: '境界値テスト')) }
                  ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(zero_scores.merge(comment: '最低点')) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(max_scores.merge(comment: '満点')) }
                ]
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
            "comment": "それって本当？"
          }
          ```
        JSON

        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: json_with_codeblock }
                ]
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to be_present
        expect(result[:comment]).to eq('それって本当？')
      end

      it 'JSONがmarkdownのコードブロックで囲まれている場合に解析できること' do
        json_with_markdown = "```json\n#{JSON.generate(base_scores.merge(comment: 'テスト'))}\n```"

        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: json_with_markdown }
                ]
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
              "comment": "それって本当？"
            }
            ```
            以上です。
          TEXT

          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: json_with_surrounding_text }
                  ]
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('それって本当？')
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
            candidates: [
              {
                content: {
                  parts: [
                    { text: json_with_multiple_blocks }
                  ]
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
              "comment": "それって本当？"
            }
            ```
          TEXT

          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: json_without_json_marker }
                  ]
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('それって本当？')
        end
      end
    end

    context '異常系' do
      it 'JSONが不正な場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: 'invalid json{' }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(incomplete_scores.merge(comment: 'テスト')) }
                ]
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

      it 'candidatesが空の場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          candidates: []
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'candidatesがnilの場合はinvalid_responseエラーコードを返すこと' do
        response_hash = {
          candidates: nil
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが空文字列の場合にパースできること（親クラスでバリデーション）' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(base_scores.merge(comment: '')) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(base_scores) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(invalid_scores.merge(comment: 'テスト')) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(invalid_scores.merge(comment: 'テスト')) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(base_scores.merge(comment: long_comment)) }
                ]
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
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.generate(base_scores.merge(comment: exact_comment)) }
                ]
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
  it_behaves_like 'adapter api key validation', 'GEMINI_API_KEY'

  # 何を検証するか: Integration Test（VCR使用）
  describe '#judge (Integration)', vcr: true do
    let(:adapter) { described_class.new }

    # VCRカセットが作成されるまでスキップ
    before { skip 'VCRカセットを作成する必要があります' }

    context '正常系' do
      it '正常に審査結果を返す', :vcr do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be true
        expect(result.scores).to be_a(Hash)
        expect(result.scores.keys).to include(:empathy, :humor, :brevity, :originality, :expression)
        expect(result.comment).to be_a(String)
      end

      it 'ひろゆき風のバイアスが適用されること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        # 元のスコアが15の場合、バイアス適用後の値を検証
        # ひろゆき風: 独創性+3、共感度-2
        expect(result.scores[:originality]).to eq(18) # 15 + 3
        expect(result.scores[:empathy]).to eq(13) # 15 - 2
      end

      it 'バイアス適用後もスコアが0-20の範囲内に収まること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        result.scores.each do |key, score|
          expect(score).to be_between(0, 20), "スコア#{key}が範囲外: #{score}"
        end
      end
    end

    context '異常系' do
      it 'タイムアウト時にtimeoutエラーコードを返す', vcr: 'timeout' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'レート制限時にprovider_errorエラーコードを返す', vcr: 'rate_limit' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('provider_error')
      end

      it '不正なJSONが返された場合はinvalid_responseエラーコードを返す', vcr: 'invalid_json' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'candidatesが空の場合はinvalid_responseエラーコードを返す', vcr: 'empty_candidates' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

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
      expect(prompts.first).to include('あなたは「ひろゆき風」')
    end
  end

  # 何を検証するか: ログ出力
  describe 'ログ出力' do
    let(:adapter) { described_class.new }

    it 'API呼び出し成功時にINFOレベルでログを出力すること' do
      # モックの設定
      adapter = described_class.new
      allow(adapter).to receive(:build_request).and_return({})

      response = instance_double(Faraday::Response, status: 200, body: '{}')
      allow(adapter).to receive(:execute_request).and_return(response)

      # valid_score_keys? を通過するために有効なスコアを返す
      valid_scores = {
        empathy: 15,
        humor: 15,
        brevity: 15,
        originality: 15,
        expression: 15
      }
      allow(adapter).to receive(:parse_response).and_return({ scores: valid_scores, comment: 'test' })
      # apply_persona_bias! は成功結果を受け取るので、そのまま返す
      allow(adapter).to receive(:apply_persona_bias!) { |result, _| result }

      expect(Rails.logger).to receive(:info).with(/審査成功/)
      adapter.judge('テスト投稿', persona: 'hiroyuki')
    end

    it 'リトライ時にWARNレベルでログを出力すること' do
      adapter = described_class.new
      allow(adapter).to receive(:build_request).and_return({})

      # 初回はエラー、2回目は成功
      allow(adapter).to receive(:execute_request).and_raise(Faraday::TimeoutError)
      allow(adapter).to receive(:retry_sleep) # sleepをスキップ

      # リトライログの確認
      expect(Rails.logger).to receive(:warn).with(%r{リトライ 1/3: Faraday::TimeoutError})

      # loop/retryのテスト用モック
      call_count = 0
      allow(adapter).to receive(:execute_request) do
        call_count += 1
        raise Faraday::TimeoutError if call_count == 1

        instance_double(Faraday::Response, status: 200, body: '{}')
      end

      valid_scores = {
        empathy: 15,
        humor: 15,
        brevity: 15,
        originality: 15,
        expression: 15
      }
      allow(adapter).to receive(:parse_response).and_return({ scores: valid_scores, comment: 'test' })
      allow(adapter).to receive(:apply_persona_bias!) { |result, _| result }

      adapter.judge('テスト投稿', persona: 'hiroyuki')
    end

    it 'APIエラー時にERRORレベルでログを出力すること' do
      adapter = described_class.new
      allow(adapter).to receive(:build_request).and_return({})

      # レート制限エラー
      allow(adapter).to receive(:execute_request).and_raise(Faraday::ClientError.new('rate limit',
                                                                                     response: { status: 429 }))
      allow(adapter).to receive(:retry_sleep)

      # ERRORログの確認（with_retryとhandle_errorで2回出力される可能性があるため、at_least(:once)）
      expect(Rails.logger).to receive(:error).with(/審査失敗: Faraday::ClientError/).at_least(:once)

      adapter.judge('テスト投稿', persona: 'hiroyuki')
    end
  end
end
