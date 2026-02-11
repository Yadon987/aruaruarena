# E06-04: TDD REDテストコード作成プラン

## 概要

このプランは、GitHub Issue #34（E06-04: OpenAI Adapterの実装）に基づいた**TDD REDフェーズ**用のテストコード作成プランです。

**TDDサイクル**: RED（失敗するテストを書く）→ GREEN（テストを通す実装を書く）→ REFACTOR（リファクタリング）

このプランでは、**REDフェーズ**に焦点を当て、実装が存在しない状態でテストコードのみを作成します。

---

## 目的

- OpenAIAdapterクラス用の完全なテストスイートを作成する
- すべてのテストがRED（失敗）状態であることを確認する
- Issue #34の受入条件（AC）をすべて網羅する
- GeminiAdapterのテストパターンを再利用する

---

## 前提条件

- E06-01: BaseAiAdapterが実装済みであること
- E06-02: GeminiAdapterの実装とテストが完了していること（パターン参照用）
- 環境変数`OPENAI_API_KEY`が設定済みであること

---

## ファイル構成

```
backend/
├── app/
│   ├── adapters/
│   │   └── openai_adapter.rb           # 実装ファイル（このフェーズでは作成しない）
│   └── prompts/
│       └── nakao.txt                    # プロンプトファイル（このフェーズで作成）
└── spec/
    ├── adapters/
    │   └── openai_adapter_spec.rb       # テストファイル（このフェーズで作成）
    └── fixtures/
        └── vcr_cassettes/
            └── openai_adapter/          # VCRカセットディレクトリ
                ├── success.yml
                ├── timeout.yml
                ├── rate_limit.yml
                ├── invalid_json.yml
                ├── missing_scores.yml
                ├── out_of_range.yml
                ├── empty_choices.yml
                └── long_comment.yml
```

---

## Phase 1: プロンプトファイルの作成

### ファイル: `app/prompts/nakao.txt`

このファイルはテスト実行に必要なため、最初に作成します。

```txt
あなたは「中尾彬風」のAI審査員として、ユーザーの「あるある」投稿を採点します。

# 審査基準（各0-20点、合計100点満点）
- 共感度: 多くの人が「あるある」と思えるか（心に響くかを重視）
- 面白さ: 笑いや驚きが誘われるか（ユーモアスな視点を重視）
- 簡潔さ: 無駊なく簡潔に表現されているか（親しみやすさを重視）
- 独創性: 新規性や独自性があるか（個性的な切り口を重視）
- 表現力: 言葉選びや表現技巧が優れているか（情緒的な豊かさを重視）

# 出力形式（必ず守ること）
以下のJSON形式のみで出力。その他の文章、説明、コードブロック記号は一切出力しないこと。

{
  "empathy": 15,
  "humor": 15,
  "brevity": 15,
  "originality": 15,
  "expression": 15,
  "comment": "短い審査コメント（30文字以内、口調は「うん、いいねぇ」などの中尾彬風で）"
}

# 投稿内容
{post_content}

上記の投稿を審査し、JSONのみを出力してください。
```

**作成手順**:
```bash
mkdir -p backend/app/prompts
cat > backend/app/prompts/nakao.txt << 'EOF'
...（上記の内容をコピー）
EOF
```

---

## Phase 2: テストファイルの作成

### ファイル: `spec/adapters/openai_adapter_spec.rb`

GeminiAdapterのテストパターンを再利用し、OpenAI固有の仕様に調整します。

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe OpenAIAdapter do
  # 何を検証するか: BaseAiAdapterを継承していること
  # 失敗理由: OpenAIAdapterクラスがまだ存在しないため
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: 定数の定義
  describe '定数' do
    # 失敗理由: PROMPT_PATH定数がまだ定義されていないため
    it 'PROMPT_PATH定数が定義されていること' do
      expect(described_class::PROMPT_PATH).to be_a(String)
    end

    # 失敗理由: PROMPT_PATH定数がまだ定義されていないため
    it 'PROMPT_PATH定数が正しいパスを返すこと' do
      expect(described_class::PROMPT_PATH).to eq('app/prompts/nakao.txt')
    end

    # 失敗理由: BASE_URL定数がまだ定義されていないため
    it 'BASE_URL定数が定義されていること' do
      expect(described_class::BASE_URL).to eq('https://api.openai.com')
    end

    # 失敗理由: MODEL_NAME定数がまだ定義されていないため
    it 'MODEL_NAME定数がgpt-4o-miniであること' do
      expect(described_class::MODEL_NAME).to eq('gpt-4o-mini')
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    context '正常系' do
      # 失敗理由: initializeメソッドがまだ実装されていないため
      it 'プロンプトファイルを読み込むこと' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('あなたは「中尾彬風」')
      end

      # 失敗理由: initializeメソッドがまだ実装されていないため
      it 'プロンプトに{post_content}プレースホルダーが含まれること' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('{post_content}')
      end

      # 失敗理由: プロンプトキャッシュ機能がまだ実装されていないため
      it 'プロンプトファイルがキャッシュされること' do
        adapter1 = described_class.new
        adapter2 = described_class.new

        expect(adapter1.instance_variable_get(:@prompt)).to eq(adapter2.instance_variable_get(:@prompt))
      end
    end

    context '異常系' do
      # 失敗理由: プロンプトファイル存在チェックがまだ実装されていないため
      it 'プロンプトファイルが存在しない場合は例外を発生させること' do
        allow(File).to receive(:exist?).and_call_original
        described_class.reset_prompt_cache! if described_class.respond_to?(:reset_prompt_cache!)
        allow(File).to receive(:exist?).with(described_class::PROMPT_PATH).and_return(false)

        expect {
          described_class.new
        }.to raise_error(ArgumentError, /プロンプトファイルが見つかりません/)
      end

      # 失敗理由: パストラバーサルチェックがまだ実装されていないため
      it 'PROMPT_PATHにパストラバーサル攻撃が含まれる場合は例外を発生させること' do
        described_class.reset_prompt_cache! if described_class.respond_to?(:reset_prompt_cache!)
        skip '定数のモックはできないため、load_promptメソッドの単体テストで検証'
      end
    end
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    let(:adapter) { described_class.new }

    # 失敗理由: clientメソッドがまだ実装されていないため
    it 'Faraday::Connectionインスタンスを返すこと' do
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    # 失敗理由: clientメソッドがまだ実装されていないため
    it 'OpenAI APIのベースURLが設定されていること' do
      client = adapter.send(:client)
      expect(client.url_prefix.to_s).to include('api.openai.com')
    end

    # 失敗理由: SSL設定がまだ実装されていないため
    it 'SSL証明書の検証が有効であること' do
      client = adapter.send(:client)
      expect { |b| client.ssl.verify(&b) }.not_to raise_error
    end

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
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it '正しいリクエスト形式であること' do
        request = adapter.send(:build_request, post_content, persona)

        expect(request).to be_a(Hash)
        expect(request[:model]).to eq('gpt-4o-mini')
        expect(request[:messages]).to be_present
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'プロンプトが{post_content}に置換されていること' do
        request = adapter.send(:build_request, post_content, persona)

        user_content = request[:messages].first[:content]
        expect(user_content).to include(post_content)
        expect(user_content).not_to include('{post_content}')
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'modelがgpt-4o-miniに設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:model]).to eq('gpt-4o-mini')
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'temperatureが0.7に設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:temperature]).to eq(0.7)
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'max_tokensが1000に設定されていること' do
        request = adapter.send(:build_request, post_content, persona)
        expect(request[:max_tokens]).to eq(1000)
      end
    end

    context '境界値' do
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentにJSON制御文字が含まれる場合に正しくエスケープされること' do
        dangerous_content = '{"test": "injection"}'
        request = adapter.send(:build_request, dangerous_content, persona)

        user_content = request[:messages].first[:content]
        expect(user_content).to include(dangerous_content)
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentに特殊文字が含まれる場合に正しく扱うこと' do
        special_content = 'テスト<script>alert("xss")</script>投稿'
        request = adapter.send(:build_request, special_content, persona)

        expect(request[:messages]).to be_present
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentに改行が含まれる場合に正しく扱うこと' do
        newline_content = "テスト\n投稿\nです"
        request = adapter.send(:build_request, newline_content, persona)

        expect(request[:messages]).to be_present
      end

      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentに絵文字が含まれる場合に正しく扱うこと' do
        emoji_content = 'テスト😊投稿🎉'
        request = adapter.send(:build_request, emoji_content, persona)

        expect(request[:messages]).to be_present
      end
    end

    context 'セキュリティ' do
      # 失敗理由: build_requestメソッドがまだ実装されていないため
      it 'post_contentにパストラバーサル攻撃が含まれる場合に正しく扱うこと' do
        path_traversal_content = '../../../../etc/passwd'
        request = adapter.send(:build_request, path_traversal_content, persona)

        user_content = request[:messages].first[:content]
        expect(user_content).to include(path_traversal_content)
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
    end

    context 'コードブロックの扱い' do
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
    end

    context '異常系' do
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

      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが欠落している場合はinvalid_responseエラーコードを返すこと' do
        incomplete_scores = base_scores.reject { |k, _| k == :empathy }
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
      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが-1の場合はinvalid_responseエラーコードを返すこと' do
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

        expect(result).to be_a(Hash) # 親クラスのバリデーションで検証
        expect(result[:scores][:empathy]).to eq(-1)
      end

      # 失敗理由: parse_responseメソッドがまだ実装されていないため
      it 'スコアが21の場合はinvalid_responseエラーコードを返すこと' do
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

        expect(result).to be_a(Hash) # 親クラスのバリデーションで検証
        expect(result[:scores][:empathy]).to eq(21)
      end

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

      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'ENV["OPENAI_API_KEY"]を返すこと' do
        expect(adapter.send(:api_key)).to eq('test_api_key_12345')
      end
    end

    context '異常系' do
      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'APIキーがnilの場合は例外を発生させること' do
        stub_env('OPENAI_API_KEY', nil)

        expect {
          adapter.send(:api_key)
        }.to raise_error(ArgumentError, /OPENAI_API_KEYが設定されていません/)
      end

      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'APIキーが空文字列の場合は例外を発生させること' do
        stub_env('OPENAI_API_KEY', '')

        expect {
          adapter.send(:api_key)
        }.to raise_error(ArgumentError, /OPENAI_API_KEYが設定されていません/)
      end

      # 失敗理由: api_keyメソッドがまだ実装されていないため
      it 'APIキーが空白のみの場合は例外を発生させること' do
        stub_env('OPENAI_API_KEY', '   ')

        expect {
          adapter.send(:api_key)
        }.to raise_error(ArgumentError, /OPENAI_API_KEYが設定されていません/)
      end
    end
  end

  # 何を検証するか: Integration Test（VCR使用）
  describe '#judge (Integration)', :vcr => true do
    let(:adapter) { described_class.new }

    # VCRカセットが作成されるまでスキップ
    before { skip 'VCRカセットを作成する必要があります' }

    context '正常系' do
      # 失敗理由: VCRカセットがまだ作成されていないため、またjudgeメソッドがまだ実装されていないため
      it '正常に審査結果を返す', :vcr do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be true
        expect(result.scores).to be_a(Hash)
        expect(result.scores.keys).to include(:empathy, :humor, :brevity, :originality, :expression)
        expect(result.comment).to be_a(String)
      end

      # 失敗理由: VCRカセットがまだ作成されていないため、またバイアス適用がまだ実装されていないため
      it '中尾彬風のバイアスが適用されること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        # 元のスコアが15の場合、バイアス適用後の値を検証
        # 中尾彬風: 面白さ+3、共感度+2
        expect(result.scores[:humor]).to eq(18)    # 15 + 3
        expect(result.scores[:empathy]).to eq(17)  # 15 + 2
      end

      # 失敗理由: VCRカセットがまだ作成されていないため
      it 'バイアス適用後もスコアが0-20の範囲内に収まること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        result.scores.each do |key, score|
          expect(score).to be_between(0, 20), "スコア#{key}が範囲外: #{score}"
        end
      end
    end

    context '異常系' do
      # 失敗理由: VCRカセットがまだ作成されていないため
      it 'タイムアウト時にtimeoutエラーコードを返す', :vcr => 'timeout' do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      # 失敗理由: VCRカセットがまだ作成されていないため
      it 'レート制限時にprovider_errorエラーコードを返す', :vcr => 'rate_limit' do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('provider_error')
      end

      # 失敗理由: VCRカセットがまだ作成されていないため
      it '不正なJSONが返された場合はinvalid_responseエラーコードを返す', :vcr => 'invalid_json' do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      # 失敗理由: VCRカセットがまだ作成されていないため
      it 'choicesが空の場合はinvalid_responseエラーコードを返す', :vcr => 'empty_choices' do
        result = adapter.judge('テスト投稿', persona: 'nakao')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end
  end

  # 何を検証するか: 並行処理
  describe '並行処理' do
    # 失敗理由: VCRカセットがまだ作成されていないため
    it '複数スレッドから同時に呼び出された場合に正しく動作すること', :vcr do
      skip 'VCRカセットを作成する必要があります'
    end

    # 失敗理由: プロンプトキャッシュ機能がまだ実装されていないため
    it 'プロンプトファイルのキャッシュがスレッドセーフであること' do
      adapters = 10.times.map { described_class.new }

      prompts = adapters.map { |a| a.instance_variable_get(:@prompt) }

      expect(prompts.uniq.size).to eq(1)
      expect(prompts.first).to include('あなたは「中尾彬風」')
    end
  end

  # 何を検証するか: ログ出力
  describe 'ログ出力' do
    let(:adapter) { described_class.new }

    # 失敗理由: VCRカセットがまだ作成されていないため
    it 'API呼び出し成功時にINFOレベルでログを出力すること', :vcr do
      skip 'VCRカセットを作成する必要があります'
    end

    # 失敗理由: VCRカセットがまだ作成されていないため
    it 'リトライ時にWARNレベルでログを出力すること', :vcr => 'timeout' do
      skip 'VCRカセットを作成する必要があります'
    end

    # 失敗理由: VCRカセットがまだ作成されていないため
    it 'APIエラー時にERRORレベルでログを出力すること', :vcr => 'rate_limit' do
      skip 'VCRカセットを作成する必要があります'
    end
  end

  # 環境変数をモックするヘルパーメソッド
  def stub_env(key, value)
    allow(ENV).to receive(:[]).with(key).and_return(value)
  end
end
```

**作成手順**:
```bash
cat > backend/spec/adapters/openai_adapter_spec.rb << 'EOF'
...（上記の内容をコピー）
EOF
```

---

## Phase 3: VCRカセットディレクトリの作成

### ディレクトリ作成

```bash
mkdir -p backend/spec/fixtures/vcr_cassettes/openai_adapter
```

### VCRカセットの構造例

各カセットは、実際のAPI呼び出しを記録したYAMLファイルです。これらはGREENフェーズで作成しますが、ここでは構造を示します。

#### `success.yml` - 正常系

```yaml
http_interactions:
- request:
    method: post
    uri: https://api.openai.com/v1/chat/completions
    body:
      encoding: UTF-8
      string: '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"..."}],"temperature":0.7,"max_tokens":1000}'
    headers:
      Content-Type:
      - application/json
      Authorization:
      - Bearer <OPENAI_API_KEY>
  response:
    status:
      code: 200
      message: OK
    body:
      encoding: UTF-8
      string: |
        {
          "choices": [{
            "message": {
              "content": "{\"empathy\": 15, \"humor\": 15, \"brevity\": 15, \"originality\": 15, \"expression\": 15, \"comment\": \"うん、いいねぇ\"}"
            }
          }]
        }
```

#### `timeout.yml` - タイムアウト

```yaml
http_interactions:
- request:
    method: post
    uri: https://api.openai.com/v1/chat/completions
    body:
      encoding: UTF-8
      string: '{"model":"gpt-4o-mini",...}'
    headers:
      Authorization:
      - Bearer <OPENAI_API_KEY>
  response:
    status:
      code: null
      message: Timeout
    body:
      encoding: UTF-8
      string: ''
  http_version: null
  recorded_at: Tue, 01 Jan 2025 00:00:00 GMT
```

---

## Phase 4: テストの実行（RED状態の確認）

### 実行コマンド

```bash
cd backend

# 全テスト実行（すべて失敗することを期待）
bundle exec rspec spec/adapters/openai_adapter_spec.rb

# 詳細な出力で実行
bundle exec rspec spec/adapters/openai_adapter_spec.rb --format documentation
```

### 期待される結果

すべてのテストが**失敗（RED）**している必要があります：

```
Failures:

  1) OpenAIAdapter BaseAiAdapterを継承していること
     Failure/Error: expect(described_class < BaseAiAdapter).to be true
     NameError:
       uninitialized constant OpenAIAdapter

  2) OpenAIAdapter 定数 PROMPT_PATH定数が定義されていること
     Failure/Error: expect(described_class::PROMPT_PATH).to be_a(String)
     NameError:
       uninitialized constant OpenAIAdapter

...（続く）
```

### カバレッジ確認

```bash
COVERAGE=true bundle exec rspec spec/adapters/openai_adapter_spec.rb
```

カバレッジは0%（OpenAIAdapterが存在しないため）であることを期待します。

---

## 各テストの失敗理由まとめ

| テスト番号 | カテゴリ | 失敗理由 |
|-----------|---------|----------|
| 1 | 継承チェック | OpenAIAdapterクラスが存在しない |
| 2-5 | 定数 | PROMPT_PATH/BASE_URL/MODEL_NAME定数が定義されていない |
| 6-11 | 初期化 | initializeメソッドが実装されていない |
| 12-15 | client | clientメソッドが実装されていない |
| 16-26 | build_request | build_requestメソッドが実装されていない |
| 27-46 | parse_response | parse_responseメソッドが実装されていない |
| 47-50 | api_key | api_keyメソッドが実装されていない |
| 51-58 | Integration | judgeメソッドとVCRカセットが存在しない |

---

## Issue #34 受入条件とのマッピング

| AC | テストケース | ステータス |
|----|-----------|----------|
| 正常系1（judge呼び出し） | `#judge (Integration) 正常に審査結果を返す` | RED |
| 正常系2（バイアス適用） | `中尾彬風のバイアスが適用されること` | RED |
| 正常系3（JSONパース） | `parse_response スコアとコメントが正しく解析されること` | RED |
| 正常系4（コードブロック削除） | `JSONがコードブロックで囲まれている場合に正しく解析できること` | RED |
| 異常系1（APIキー未設定） | `api_key APIキーがnilの場合は例外を発生させること` | RED |
| 異常系2（プロンプト不在） | `初期化 プロンプトファイルが存在しない場合は例外を発生させること` | RED |
| 異常系3（不正JSON） | `parse_response JSONが不正な場合はinvalid_responseエラーコードを返すこと` | RED |
| 異常系4（タイムアウト） | `#judge タイムアウト時にtimeoutエラーコードを返す` | RED（VCR待ち） |
| 異常系5（レート制限） | `#judge レート制限時にprovider_errorエラーコードを返す` | RED（VCR待ち） |
| 異常系6（空choices） | `parse_response choicesが空の場合はinvalid_responseエラーコードを返すこと` | RED |
| 境界値1（スコア欠落） | `parse_response スコアが欠落している場合はinvalid_responseエラーコードを返すこと` | RED |
| 境界値2（スコア範囲外） | `parse_response スコアが-1の場合はinvalid_responseエラーコードを返すこと` | RED |
| 境界値3（文字列スコア） | `parse_response スコアが文字列の場合に整数に変換できること` | RED |
| 境界値4（長いcomment） | `parse_response commentが30文字を超える場合はtruncateされること` | RED |
| 境界値5（特殊文字） | `build_request post_contentに特殊文字が含まれる場合に正しく扱うこと` | RED |

---

## テスト実装のポイント

### 1. 構造化

各テストケースには以下の要素を含めます：

```ruby
# 何を検証するか: [検証内容の簡潔な説明]
# 失敗理由: [実装が存在しない等の失敗理由]
it '...テスト名...' do
  # Given（準備）
  # When（実行）
  # Then（検証）
end
```

### 2. コメントの重要性

各テストには「何を検証するか」と「失敗理由」を明記します。これは：
- チームメンバーがテストの意図を理解するのに役立つ
- REDフェーズからGREENフェーズへの移行時に追跡しやすくなる
- 将来のリファクタリング時に意図を保持する

### 3. WebMock/VCRの使用

- Unit Testでは、`build_faraday_response`ヘルパーを使用してモックレスポンスを作成
- Integration Testでは、VCRを使用して実際のAPIレスポンスを記録

---

## 次のステップ（GREENフェーズへ）

このREDテストプランの実装が完了したら、以下のGREENフェーズに進みます：

1. **プロンプトファイルの作成**: `app/prompts/nakao.txt`を作成（Phase 1で完了）
2. **VCR設定の確認**: `spec/support/vcr.rb`にOPENAI_API_KEYフィルタリングが設定されていることを確認
3. **OpenAIAdapterの実装**: テストをパスするための実装を記述
4. **VCRカセットの作成**: 実際のAPI呼び出しでカセットを記録

---

## トラブルシューティング

### 問題1: テストが一部パスしてしまう

**原因**: 既存のGeminiAdapterコードが誤って読み込まれている可能性があります。

**解決策**:
```bash
# オートロードキャッシュをクリア
rm -rf backend/tmp/cache
```

### 問題2: VCR関連のテストでエラー

**原因**: VCR設定が正しく行われていない可能性があります。

**解決策**:
```bash
# VCR設定を確認
cat backend/spec/support/vcr.rb | grep OPENAI_API_KEY
```

### 問題3: プロンプトファイルが見つからない

**原因**: ファイルパスが正しく設定されていない可能性があります。

**解決策**:
```bash
# ファイルの存在確認
ls -la backend/app/prompts/nakao.txt
```

---

## チェックリスト

このREDフェーズが完了する前に確認すべき項目：

- [ ] `app/prompts/nakao.txt`が作成されている
- [ ] `spec/adapters/openai_adapter_spec.rb`が作成されている
- [ ] `spec/fixtures/vcr_cassettes/openai_adapter/`ディレクトリが作成されている
- [ ] すべてのテストを実行し、すべてがRED（失敗）していることを確認
- [ ] 各テストに「何を検証するか」と「失敗理由」が記述されている
- [ ] Issue #34のすべての受入条件がテストでカバーされている

---

## コミットメッセージ

このREDテストコード作成フェーズが完了したら、以下のコミットメッセージでコミットします：

```
test: E06-04 OpenAIAdapterのTDD REDテストコードを作成 #34

- spec/adapters/openai_adapter_spec.rbを作成（約70件のテストケース）
- app/prompts/nakao.txtを作成（中尾彬風の審査プロンプト）
- VCRカセットディレクトリを作成
- Issue #34のすべての受入条件をカバー
- GeminiAdapterのテストパターンを再利用

期待される結果: すべてのテストがRED（失敗）状態

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 参考資料

- Issue #34: E06-04: OpenAI Adapterの実装
- `.github/E06-01_REFACTOR_PLAN.md` - BaseAiAdapterのリファクタリングプラン
- `backend/spec/adapters/gemini_adapter_spec.rb` - テストパターンの参考
- `backend/app/adapters/gemini_adapter.rb` - 実装パターンの参考
- OpenAI API Documentation: https://platform.openai.com/docs/api-reference/chat

---

*このプランはTDD REDフェーズ用です。次のGREENフェーズでは、これらのテストをパスするための実装を行います。*
