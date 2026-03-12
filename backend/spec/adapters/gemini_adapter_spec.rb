# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe GeminiAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }
  it_behaves_like 'base ai adapter inheritance'

  describe '定数' do
    it_behaves_like 'adapter constants', { PROMPT_PATH: 'app/prompts/hiroyuki.txt' }
  end

  describe '初期化' do
    it_behaves_like 'adapter initialization', 'ひろゆき風', false
  end

  describe '#client' do
    it_behaves_like 'gemini client', 'https://generativelanguage.googleapis.com/'
  end

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'hiroyuki' }

    context '正常系' do
      it '正しいリクエスト形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request).to be_a(Hash)
        expect(request[:systemInstruction]).to be_present
        expect(request[:contents]).to be_present
        expect(request[:generationConfig]).to be_present
      end

      it 'systemInstructionと投稿内容が分離されていること' do
        request = adapter.send(:build_request, post_content, persona)

        system_text = request[:systemInstruction][:parts].first[:text]
        user_text = request[:contents].first[:parts].first[:text]

        expect(system_text).to include('ひろゆき風')
        expect(system_text).not_to include(post_content)
        expect(user_text).to eq(post_content)
      end

      it 'generationConfigが正しく設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        config = request[:generationConfig]
        expect(config[:temperature]).to eq(0.0)
        expect(config[:topP]).to eq(0.1)
        expect(config[:topK]).to eq(1)
        expect(config[:candidateCount]).to eq(1)
        expect(config[:maxOutputTokens]).to eq(192)
        expect(config[:thinkingConfig]).to eq(thinkingBudget: 0)
      end

      it 'generationConfigにresponseMimeTypeがapplication/jsonで設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        config = request[:generationConfig]
        expect(config[:responseMimeType]).to eq('application/json')
      end

      it 'generationConfigにresponseSchemaが設定されていること' do
        request = adapter.send(:build_request, post_content, persona)

        schema = request[:generationConfig][:responseSchema]
        expect(schema[:type]).to eq('OBJECT')
        expect(schema[:required]).to include('empathy', 'humor', 'brevity', 'originality', 'expression', 'comment')
        expect(schema[:properties][:comment][:type]).to eq('STRING')
      end

      it '簡易フォールバック用リクエストもJSON固定で構築されること' do
        request = adapter.send(:build_fallback_request, post_content, persona)

        expect(request[:generationConfig][:responseMimeType]).to eq('application/json')
        expect(request[:systemInstruction][:parts].first[:text]).to include('JSONオブジェクトを1つだけ返してください')
        expect(request[:contents].first[:parts].first[:text]).to eq(post_content)
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

  describe '#retryable_result_max_retries' do
    it 'invalid_response時の再試行回数を増やしていること' do
      expect(adapter.send(:retryable_result_max_retries)).to eq(2)
    end

    it 'sync_rejudge文脈ではinvalid_responseの外側リトライを無効にすること' do
      sync_adapter = described_class.new(context: :sync_rejudge)

      expect(sync_adapter.send(:retryable_result_max_retries)).to eq(0)
    end
  end

  describe '#parse_response' do
    let(:base_scores) do
      {
        empathy: 15,
        humor: 15,
        brevity: 15,
        originality: 15,
        expression: 15
      }
    end

    it_behaves_like 'gemini parse response'

    context 'Gemini固有の正常系' do
      it '複数のpartsに分割されたJSONレスポンスも解析できること' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: "```json\n" },
                  { text: JSON.generate(base_scores.merge(comment: '分割レスポンス')) },
                  { text: "\n```" }
                ]
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to eq(base_scores.transform_keys(&:to_sym))
        expect(result[:comment]).to eq('分割レスポンス')
      end

      it 'ノイズとダミーJSONが混在していても有効な採点JSONを解析できること' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: "こんにちは！\n```json\n{\"thought\":\"分析中\"}\n```\n" },
                  { text: "採点結果です。\n```json\n" },
                  { text: JSON.generate(base_scores.merge(comment: 'ノイズ耐性テスト')) },
                  { text: "\n```" }
                ]
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to eq(base_scores.transform_keys(&:to_sym))
        expect(result[:comment]).to eq('ノイズ耐性テスト')
      end

      it 'thoughtパーツを除外してテキストを結合できること' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: '内部思考' },
                  { text: JSON.generate(base_scores.merge(comment: 'thought除外')) }
                ]
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to eq(base_scores.transform_keys(&:to_sym))
        expect(result[:comment]).to eq('thought除外')
      end

      it '末尾が途中で切れたJSONでも主要項目を補完して解析できること' do
        response_hash = {
          candidates: [
            {
              content: {
                parts: [
                  { text: '{"empathy":5,"humor":5,"brevity":18,"originality":5,"expression":5,"comment":"途中' }
                ]
              }
            }
          ]
        }
        faraday_response = build_faraday_response(response_hash)

        result = adapter.send(:parse_response, faraday_response)

        expect(result[:scores]).to eq(
          empathy: 5,
          humor: 5,
          brevity: 18,
          originality: 5,
          expression: 5
        )
        expect(result[:comment]).to eq('途中')
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

        it '```jsonの直後に改行がなくても解析できること' do
          inline_codeblock = "```json#{JSON.generate(base_scores.merge(comment: 'インライン'))}```"

          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: inline_codeblock }
                  ]
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('インライン')
        end

        it 'Windows改行の```jsonコードブロックも解析できること' do
          windows_codeblock = "```json\r\n#{JSON.generate(base_scores.merge(comment: 'CRLF対応'))}\r\n```"

          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: windows_codeblock }
                  ]
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('CRLF対応')
        end

        it 'コードブロックが閉じていない場合でもJSON本体を抽出して解析できること' do
          broken_codeblock = <<~TEXT
            以下が審査結果です。
            ```json
            {
              "empathy": 15,
              "humor": 14,
              "brevity": 16,
              "originality": 13,
              "expression": 15,
              "comment": "それって本当？"
            }
          TEXT

          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: broken_codeblock }
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

        it '前後に説明文がある生テキストからJSONを抽出して解析できること' do
          prose_with_json = <<~TEXT
            審査結果を返します。JSONのみを利用してください。
            {
              "empathy": 12,
              "humor": 11,
              "brevity": 14,
              "originality": 13,
              "expression": 15,
              "comment": "あるあるですね"
            }
            以上です。
          TEXT

          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: prose_with_json }
                  ]
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          result = adapter.send(:parse_response, faraday_response)

          expect(result[:scores]).to be_present
          expect(result[:comment]).to eq('あるあるですね')
        end

        it '壊れたJSON時に分類ログを出力すること' do
          response_hash = {
            candidates: [
              {
                content: {
                  parts: [
                    { text: '審査結果です {"empathy":12,' }
                  ]
                }
              }
            ]
          }
          faraday_response = build_faraday_response(response_hash)

          allow(Rails.logger).to receive(:warn)
          expect(Rails.logger).to receive(:warn).with(include('reason=truncated_json')).at_least(:once)

          result = adapter.send(:parse_response, faraday_response, allow_fallback: false)

          expect(result).to be_a(BaseAiAdapter::JudgmentResult)
          expect(result.error_code).to eq('invalid_response')
        end
      end
    end
  end

  describe '#call_ai_api' do
    it 'invalid_response時は簡易プロンプトで再実行すること' do
      primary_request = { mode: 'primary' }
      fallback_request = { mode: 'fallback' }
      invalid_response = build_faraday_response(
        candidates: [
          {
            content: {
              parts: [
                { text: '説明文です {"empathy":10,' }
              ]
            }
          }
        ]
      )
      valid_response = build_faraday_response(
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.generate(
                    empathy: 10,
                    humor: 11,
                    brevity: 12,
                    originality: 13,
                    expression: 14,
                    comment: '再整形成功'
                  )
                }
              ]
            }
          }
        ]
      )

      allow(adapter).to receive(:build_request).and_return(primary_request)
      allow(adapter).to receive(:build_fallback_request).and_return(fallback_request)
      allow(adapter).to receive(:execute_request).with(primary_request).and_return(invalid_response)
      allow(adapter).to receive(:execute_request).with(fallback_request).and_return(valid_response)

      result = adapter.send(:call_ai_api, 'テスト投稿', 'hiroyuki')

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.succeeded).to be true
      expect(result.comment).to eq('再整形成功')
    end

    it 'Geminiが連続失敗した場合はGroq互換へフォールバックすること' do
      primary_request = { mode: 'primary' }
      fallback_request = { mode: 'fallback' }
      invalid_response = build_faraday_response(
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here is the JSON requested:' }
              ]
            }
          }
        ]
      )
      fallback_adapter = instance_double(HiroyukiFallbackAdapter)
      fallback_result = BaseAiAdapter::JudgmentResult.new(
        succeeded: true,
        error_code: nil,
        scores: {
          empathy: 11,
          humor: 12,
          brevity: 13,
          originality: 14,
          expression: 15
        },
        comment: '代替成功'
      )

      allow(adapter).to receive(:build_request).and_return(primary_request)
      allow(adapter).to receive(:build_fallback_request).and_return(fallback_request)
      allow(adapter).to receive(:execute_request).with(primary_request).and_return(invalid_response)
      allow(adapter).to receive(:execute_request).with(fallback_request).and_return(invalid_response)
      allow(HiroyukiFallbackAdapter).to receive(:new).with(context: :default).and_return(fallback_adapter)
      allow(fallback_adapter).to receive(:judge).with('テスト投稿', persona: 'hiroyuki').and_return(fallback_result)

      result = adapter.send(:call_ai_api, 'テスト投稿', 'hiroyuki')

      expect(result.succeeded).to be true
      expect(result.comment).to eq('代替成功')
    end

    it 'Geminiのprovider_error時はGroq互換へフォールバックすること' do
      primary_request = { mode: 'primary' }
      fallback_adapter = instance_double(HiroyukiFallbackAdapter)
      fallback_result = BaseAiAdapter::JudgmentResult.new(
        succeeded: true,
        error_code: nil,
        scores: {
          empathy: 12,
          humor: 11,
          brevity: 13,
          originality: 14,
          expression: 15
        },
        comment: '認証エラー時の代替成功'
      )

      allow(adapter).to receive(:build_request).and_return(primary_request)
      allow(adapter).to receive(:execute_request).with(primary_request).and_raise(
        Faraday::ClientError.new(
          'Client error: 400',
          response: { status: 400, body: '{"error":{"message":"API Key not found"}}' }
        )
      )
      allow(HiroyukiFallbackAdapter).to receive(:new).with(context: :default).and_return(fallback_adapter)
      allow(fallback_adapter).to receive(:judge).with('テスト投稿', persona: 'hiroyuki').and_return(fallback_result)

      result = adapter.send(:call_ai_api, 'テスト投稿', 'hiroyuki')

      expect(result.succeeded).to be true
      expect(result.comment).to eq('認証エラー時の代替成功')
    end
  end

  it_behaves_like 'adapter api key validation', 'GEMINI_API_KEY'

  describe '#judge (Integration)', vcr: true do
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
      expect(Rails.logger).to receive(:warn).with(%r{リトライ 1/2: Faraday::TimeoutError})

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

  it_behaves_like 'secrets manager api key resolution',
                  secret_env_key: 'GEMINI_SECRET_ARN',
                  legacy_env_key: 'GEMINI_API_KEY'
end
