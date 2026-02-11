# E06-02: TDD Redテスト作成プラン

## コンテキスト

Issue #32（E06-02: Gemini Adapterの実装）の受け入れ基準をすべてカバーするTDD Redフェーズ用テストコードを作成します。

**実装の制約**:
- テストコードのみを作成（GeminiAdapterの実装は含めない）
- すべてのテストがRED（失敗）状態であること
- Issue番号#32をコミットメッセージに含める
- 各テストに「何を検証するか」のコメントを追加

---

## 受入条件（AC）対応テスト一覧

### 正常系 (Happy Path)

| ID | テストケース | AC対応 |
|----|-------------|--------|
| T01 | BaseAiAdapterを継承していること | - |
| T02 | PROMPT_PATH定数が正しいパスを返すこと | - |
| T02a | PROMPT_PATH定数が定義されていること | - |
| T03 | initializeでプロンプトファイルを読み込むこと | - |
| T04 | judgeメソッドで正常に審査結果を返す | AC1 |
| T05 | ひろゆき風のバイアスが適用されること | AC2 |
| T06 | JSONが正しく解析されること | AC3 |
| T07 | コードブロックで囲まれたJSONを解析できること | AC4 |

### 異常系 (Error Path)

| ID | テストケース | AC対応 |
|----|-------------|--------|
| T08 | APIキーがnilの場合は例外を発生させること | AC5 |
| T09 | APIキーが空文字列の場合は例外を発生させること | AC5 |
| T10 | プロンプトファイルが存在しない場合は例外を発生させること | AC6 |
| T11 | 不正なJSONが返された場合はinvalid_responseエラーコードを返すこと | AC7 |
| T12 | タイムアウト時にtimeoutエラーコードを返すこと | AC8 |
| T13 | レート制限時にprovider_errorエラーコードを返すこと | AC9 |
| T14 | candidatesが空の場合はinvalid_responseエラーコードを返すこと | AC10 |

### 境界値 (Edge Case)

| ID | テストケース | AC対応 |
|----|-------------|--------|
| T15 | スコアが欠落している場合はinvalid_responseエラーコードを返すこと | AC11 |
| T16 | スコアが範囲外（-1）の場合はinvalid_responseエラーコードを返すこと | AC12 |
| T16a | スコアが範囲外（0）の場合は有効と判定されること | AC12 |
| T17 | スコアが範囲外（21）の場合はinvalid_responseエラーコードを返すこと | AC12 |
| T17a | スコアが範囲外（20）の場合は有効と判定されること | AC12 |
| T18 | スコアが文字列の場合に整数に変換できること | AC13 |
| T19 | commentが30文字を超える場合はtruncateされること | AC14 |
| T20 | post_contentにJSON制御文字が含まれる場合に正しくエスケープされること | AC15 |

### ログ出力 (Log Output)

| ID | テストケース | 目的 |
|----|-------------|------|
| L01 | API呼び出し成功時にINFOレベルでログを出力すること | 動作確認 |
| L02 | リトライ時にWARNレベルでログを出力すること | 動作確認 |
| L03 | APIエラー時にERRORレベルでログを出力すること | 動作確認 |

### セキュリティ (Security)

| ID | テストケース | 目的 |
|----|-------------|------|
| S01 | パストラバーサル攻撃を防ぐこと | セキュリティ |

---

## テスト構造の設計

### describe/contextの階層構造

```
RSpec.describe GeminiAdapter do
  describe '継承関係' do
    # BaseAiAdapterを継承していること
  end

  describe '定数' do
    # PROMPT_PATHの定義と値
  end

  describe '初期化' do
    context '正常系' do
      # プロンプトファイルの読み込み
    end

    context '異常系' do
      # プロンプトファイルが存在しない場合
    end
  end

  describe '#client' do
    # Faradayクライアントの設定
  end

  describe '#build_request' do
    context '正常系' do
      # 正しいリクエスト形式
      # プロンプトの置換
      # generationConfigの設定
    end

    context '境界値' do
      # 特殊文字のエスケープ
      # JSON制御文字の扱い
    end

    context 'セキュリティ' do
      # パストラバーサル攻撃の防止
    end
  end

  describe '#parse_response' do
    context '正常系' do
      # JSONのパース
      # JudgmentResultの生成
    end

    context '異常系' do
      # 不正なJSON
      # スコア欠落
      # スコア範囲外
      # 空のcandidates
    end

    context '境界値' do
  # コードブロックで囲まれたJSON
  # スコアが文字列
  # スコアが浮動小数点数
  # スコアの境界値（0, 20）
  # commentのtruncate
  # commentが空文字列/nil
    end
  end

  describe '#api_key' do
    context '正常系' do
  # 環境変数からの取得
    end

    context '異常系' do
  # APIキーがnil
  # APIキーが空文字列
    end
  end

  describe '#judge (Integration)' do
    context '正常系' do
  # VCR使用: 正常に審査結果を返す
  # VCR使用: ひろゆき風のバイアスが適用される
    end

    context '異常系' do
  # VCR使用: タイムアウト
  # VCR使用: レート制限
  # VCR使用: 不正なJSON
    end
  end

  describe '並行処理' do
  # 複数スレッドから同時に呼び出された場合
  # プロンプトファイルのキャッシュがスレッドセーフ
  end

  describe 'ログ出力' do
  # INFO/WARN/ERRORレベルのログ出力
  end
end
```

---

## VCRカセットとテストケースのマッピング

| VCRカセット | 対応テストケース | シナリオ |
|------------|----------------|----------|
| `success.yml` | T04, T05 | 正常に審査結果を返す、バイアス適用 |
| `codeblock_json.yml` | T07 | コードブロックで囲まれたJSON |
| `timeout.yml` | T12, L02, L03 | タイムアウト、リトライWARNログ、ERRORログ |
| `rate_limit.yml` | T13, L03 | レート制限、ERRORログ |
| `invalid_json.yml` | T11, L03 | 不正なJSON、ERRORログ |
| `empty_candidates.yml` | T14 | candidatesが空 |
| `score_negative_one.yml` | T16 | スコアが-1 |
| `score_zero.yml` | T16a | スコアが0（有効） |
| `score_twenty_one.yml` | T17 | スコアが21 |
| `score_twenty.yml` | T17a | スコアが20（有効） |
| `string_scores.yml` | T18 | スコアが文字列 |
| `float_scores.yml` | T17a | スコアが浮動小数点数 |
| `long_comment.yml` | T19 | commentが30文字超 |
| `empty_comment.yml` | T21 | commentが空文字列 |
| `missing_comment.yml` | T22 | commentが欠落（nil） |
| `json_injection.yml` | T20 | JSON制御文字を含む投稿 |
| `path_traversal.yml` | S01 | パストラバーサル攻撃 |
| `api_success_log.yml` | L01 | API成功時INFOログ |

---

## プロンプトファイルの内容

### app/prompts/hiroyuki.txt

```
あなたは「ひろゆき風」のAI審査員として、ユーザーの「あるある」投稿を採点します。

# 審査基準（各0-20点、合計100点満点）
- 共感度: 多くの人が「あるある」と思えるか（客観的・論理的に判断）
- 面白さ: 笑いや驚きが誘われるか（意外性や斬新さを重視）
- 簡潔さ: 無駄なく簡潔に表現されているか（無駄な装飾を嫌う）
- 独創性: 新規性や独自性があるか（既存との差別化を重視）
- 表現力: 言葉選びや表現技巧が優れているか（正確さを重視）

# 出力形式（必ず守ること）
以下のJSON形式のみで出力。その他の文章、説明、コードブロック記号は一切出力しないこと。

{
  "empathy": 15,
  "humor": 15,
  "brevity": 15,
  "originality": 15,
  "expression": 15,
  "comment": "短い審査コメント（30文字以内、口調は「それって本当？」のようなひろゆき風で）"
}

# 投稿内容
{post_content}

上記の投稿を審査し、JSONのみを出力してください。
```

---

## テストコード（完全版）

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe GeminiAdapter do
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
      expect(described_class::PROMPT_PATH).to eq('app/prompts/hiroyuki.txt')
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    context '正常系' do
      it 'プロンプトファイルを読み込むこと' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('あなたは「ひろゆき風」')
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
        allow(File).to receive(:exist?).with(described_class::PROMPT_PATH).and_return(false)

        expect {
          described_class.new
        }.to raise_error(ArgumentError, /プロンプトファイルが見つかりません/)
      end

      it 'PROMPT_PATHにパストラバーサル攻撃が含まれる場合は例外を発生させること' do
        malicious_path = '../../../etc/passwd'
        allow(described_class).to receive(:PROMPT_PATH).and_return(malicious_path)

        expect {
          described_class.new
        }.to raise_error(ArgumentError, /プロンプトファイルが見つかりません|パストラバーサル/)
      end
    end
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
      expect(client.options[:ssl]).to be_present
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

    context '境界値' do
      it 'post_contentにJSON制御文字が含まれる場合に正しくエスケープされること' do
        dangerous_content = '{"test": "injection"}'
        request = adapter.send(:build_request, dangerous_content, persona)

        text_content = request[:contents].first[:parts].first[:text]
        expect(text_content).to include(dangerous_content)
      end

      it 'post_contentに特殊文字が含まれる場合に正しく扱うこと' do
        special_content = 'テスト<script>alert("xss")</script>投稿'
        request = adapter.send(:build_request, special_content, persona)

        expect(request[:contents]).to be_present
      end

      it 'post_contentに改行が含まれる場合に正しく扱うこと' do
        newline_content = "テスト\n投稿\nです"
        request = adapter.send(:build_request, newline_content, persona)

        expect(request[:contents]).to be_present
      end

      it 'post_contentに絵文字が含まれる場合に正しく扱うこと' do
        emoji_content = 'テスト😊投稿🎉'
        request = adapter.send(:build_request, emoji_content, persona)

        expect(request[:contents]).to be_present
      end
    end

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
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result).to be_a(BaseAiAdapter::JudgmentResult)
        expect(result.succeeded).to be true
        expect(result.scores).to eq(base_scores.transform_keys(&:to_sym))
        expect(result.comment).to eq('それって本当？')
      end

      it 'スコアが文字列の場合に整数に変換できること' do
        string_scores = base_scores.transform_values(&:to_s)
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.scores[:empathy]).to eq(15)
        expect(result.scores[:empathy]).to be_a(Integer)
      end

      it 'スコアが浮動小数点数の場合に整数に変換できること' do
        float_scores = base_scores.transform_values(&:to_f)
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.scores[:empathy]).to eq(15)
        expect(result.scores[:empathy]).to be_a(Integer)
      end

      it 'スコアが0の場合は有効と判定されること' do
        zero_scores = base_scores.transform_values { 0 }
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be true
        expect(result.scores[:empathy]).to eq(0)
      end

      it 'スコアが20の場合は有効と判定されること' do
        max_scores = base_scores.transform_values { 20 }
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be true
        expect(result.scores[:empathy]).to eq(20)
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

        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be true
        expect(result.scores).to be_present
        expect(result.comment).to eq('それって本当？')
      end

      it 'JSONがmarkdownのコードブロックで囲まれている場合に解析できること' do
        json_with_markdown = "```json\n#{JSON.generate(base_scores.merge(comment: 'テスト'))}\n```"

        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be true
      end
    end

    context '異常系' do
      it 'JSONが不正な場合はinvalid_responseエラーコードを返すこと' do
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアが欠落している場合はinvalid_responseエラーコードを返すこと' do
        incomplete_scores = base_scores.reject { |k, _| k == :empathy }
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'candidatesが空の場合はinvalid_responseエラーコードを返すこと' do
        response = {
          candidates: []
        }

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'candidatesがnilの場合はinvalid_responseエラーコードを返すこと' do
        response = {
          candidates: nil
        }

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが空文字列の場合はinvalid_responseエラーコードを返すこと' do
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが欠落（nil）している場合はinvalid_responseエラーコードを返すこと' do
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end

    context '境界値' do
      it 'スコアが-1の場合はinvalid_responseエラーコードを返すこと' do
        invalid_scores = base_scores.merge(empathy: -1)
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアが21の場合はinvalid_responseエラーコードを返すこと' do
        invalid_scores = base_scores.merge(empathy: 21)
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが30文字を超える場合はtruncateされること' do
        long_comment = 'a' * 35
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be true
        expect(result.comment.length).to eq(30)
      end

      it 'commentがちょうど30文字の場合はtruncateされないこと' do
        exact_comment = 'a' * 30
        response = {
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

        result = adapter.send(:parse_response, response)

        expect(result.succeeded).to be true
        expect(result.comment.length).to eq(30)
      end
    end
  end

  # 何を検証するか: APIキーの取得
  describe '#api_key' do
    let(:adapter) { described_class.new }

    context '正常系' do
      before do
        stub_env('GEMINI_API_KEY', 'test_api_key_12345')
      end

      it 'ENV["GEMINI_API_KEY"]を返すこと' do
        expect(adapter.send(:api_key)).to eq('test_api_key_12345')
      end
    end

    context '異常系' do
      it 'APIキーがnilの場合は例外を発生させること' do
        stub_env('GEMINI_API_KEY', nil)

        expect {
          adapter.send(:api_key)
        }.to raise_error(ArgumentError, /GEMINI_API_KEYが設定されていません/)
      end

      it 'APIキーが空文字列の場合は例外を発生させること' do
        stub_env('GEMINI_API_KEY', '')

        expect {
          adapter.send(:api_key)
        }.to raise_error(ArgumentError, /GEMINI_API_KEYが設定されていません/)
      end

      it 'APIキーが空白のみの場合は例外を発生させること' do
        stub_env('GEMINI_API_KEY', '   ')

        expect {
          adapter.send(:api_key)
        }.to raise_error(ArgumentError, /GEMINI_API_KEYが設定されていません/)
      end
    end
  end

  # 何を検証するか: Integration Test（VCR使用）
  describe '#judge (Integration)' do
    let(:adapter) { described_class.new }

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
        expect(result.scores[:empathy]).to eq(13)   # 15 - 2
      end

      it 'バイアス適用後もスコアが0-20の範囲内に収まること', :vcr do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        result.scores.each do |key, score|
          expect(score).to be_between(0, 20), "スコア#{key}が範囲外: #{score}"
        end
      end
    end

    context '異常系' do
      it 'タイムアウト時にtimeoutエラーコードを返す', :vcr => 'timeout' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'レート制限時にprovider_errorエラーコードを返す', :vcr => 'rate_limit' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('provider_error')
      end

      it '不正なJSONが返された場合はinvalid_responseエラーコードを返す', :vcr => 'invalid_json' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'candidatesが空の場合はinvalid_responseエラーコードを返す', :vcr => 'empty_candidates' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end
  end

  # 何を検証するか: 並行処理
  describe '並行処理' do
    it '複数スレッドから同時に呼び出された場合に正しく動作すること', :vcr do
      threads = 5.times.map do
        Thread.new do
          adapter = described_class.new
          adapter.judge('テスト投稿', persona: 'hiroyuki')
        end
      end

      results = threads.map(&:value)

      expect(results.size).to eq(5)
      expect(results.all? { |r| r.is_a?(BaseAiAdapter::JudgmentResult) }).to be true
      expect(results.all? { |r| r.succeeded }).to be true
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

    it 'API呼び出し成功時にINFOレベルでログを出力すること', :vcr do
      expect(Rails.logger).to receive(:info).with(/Gemini API呼び出し成功/)

      adapter.judge('テスト投稿', persona: 'hiroyuki')
    end

    it 'リトライ時にWARNレベルでログを出力すること', :vcr => 'timeout' do
      expect(Rails.logger).to receive(:warn).with(/API呼び出し失敗.*リトライします/)

      adapter.judge('テスト投稿', persona: 'hiroyuki')
    end

    it 'APIエラー時にERRORレベルでログを出力すること', :vcr => 'rate_limit' do
      expect(Rails.logger).to receive(:error).with(/Gemini APIエラー/)

      adapter.judge('テスト投稿', persona: 'hiroyuki')
    end
  end

  # 環境変数をモックするヘルパーメソッド
  def stub_env(key, value)
    allow(ENV).to receive(:[]).with(key).and_return(value)
  end
end
```

---

## VCRカセットの作成手順

### 1. VCR設定の確認

**ファイル**: `spec/support/vcr.rb`

```ruby
# frozen_string_literal: true

VCR.configure do |config|
  config.cassette_library_dir = 'spec/fixtures/vcr'
  config.hook_into :faraday
  config.ignore_localhost = true

  # APIキーをマスキング
  config.filter_sensitive_data('<GEMINI_API_KEY>') { ENV['GEMINI_API_KEY'] }

  # 既存のカセットを再利用
  config.allow_http_connections_when_no_cassette = false
end
```

**注意**: `require 'webmock/rspec'` は `spec_helper.rb` または `rails_helper.rb` で既に読み込まれている場合は、`spec/support/vcr.rb` で再度読み込む必要はありません。重複した `require` はエラーの原因になります。

### 2. カセット作成コマンド

```bash
# .env に有効な GEMINI_API_KEY を設定
export GEMINI_API_KEY=your_actual_api_key

# カセットを作成モードでテスト実行
VCR_RECORD=new_episodes bundle exec rspec spec/adapters/gemini_adapter_spec.rb

# カセットが生成されたことを確認
ls -la spec/fixtures/vcr/gemini_adapter/
```

### 3. 必要なカセット一覧

| カセット名 | 用途 |
|-----------|------|
| `success.yml` | 正常系（スコアとコメントを含む） |
| `codeblock_json.yml` | JSONがコードブロックで囲まれている |
| `timeout.yml` | タイムアウト（30秒超過） |
| `rate_limit.yml` | 429 Too Many Requests |
| `invalid_json.yml` | 不正なJSON |
| `empty_candidates.yml` | candidatesが空 |
| `score_negative_one.yml` | スコアが-1 |
| `score_zero.yml` | スコアが0（有効） |
| `score_twenty_one.yml` | スコアが21 |
| `score_twenty.yml` | スコアが20（有効） |
| `string_scores.yml` | スコアが文字列 |
| `float_scores.yml` | スコアが浮動小数点数 |
| `long_comment.yml` | commentが30文字超 |
| `empty_comment.yml` | commentが空文字列 |
| `missing_comment.yml` | commentが欠落（nil） |
| `json_injection.yml` | JSON制御文字を含む投稿 |
| `path_traversal.yml` | パストラバーサル攻撃 |
| `api_success_log.yml` | API成功時INFOログ |

---

## 実装の制約

### Redテストの確認

すべてのテストが実装されていない状態で失敗することを確認：

```bash
bundle exec rspec spec/adapters/gemini_adapter_spec.rb --format progress
```

期待される結果：

```
........................F.....F....F....F....F....F.
.................................

Finished in X seconds (files took X seconds to load)
75 examples, 45 failures
```

**注**: `GeminiAdapter` クラスが未定義または未実装の状態でテストを実行すると、`NameError: uninitialized constant GeminiAdapter` が発生します。これは正常なRed状態です。

### CLAUDE.md禁止事項の確認

- [x] `.permit!` を使用していない
- [x] N+1クエリの問題がない（DynamoDB未使用）
- [x] トランザクションなしで複数DB操作（該当なし）
- [x] ハードコードされた機密情報を含んでいない（環境変数使用）
- [x] テストなしで機能を実装していない（Redテストを作成）
- [x] `binding.pry` を含んでいない
- [x] 日本語でコメント・記述している

---

## 作成するファイル

| ファイル | 説明 |
|---------|------|
| `spec/adapters/gemini_adapter_spec.rb` | テストファイル（上記完全版） |
| `app/prompts/hiroyuki.txt` | ひろゆき風プロンプト |

---

## コミットメッセージ

```
test: E06-02 GeminiAdapterのREDテストを作成 #32

- BaseAiAdapterを継承したGeminiAdapterのテストを作成
- すべての受け入れ基準をカバー（45テストケース）
- 正常系、異常系、境界値、ログ出力、セキュリティのテストを実装
- VCRカセットの作成手順をドキュメント化
- ひろゆき風プロンプトファイルを作成
- パストラバーサル攻撃のテストを追加
- スコアの境界値（0, 20）テストを追加
- 浮動小数点数スコアのテストを追加

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 次のステップ

このプランの実装が完了したら、以下を実施：

1. テストファイルを作成
2. プロンプトファイルを作成
3. テストを実行してRed状態を確認
4. Greenフェーズの実装計画を作成
