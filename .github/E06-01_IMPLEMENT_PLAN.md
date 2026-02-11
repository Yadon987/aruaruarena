# E06-01: AI Adapter基底クラスの実装

## コンテキスト

E06「AI審査システム」の最初のストーリーとして、3種類のAIサービス（Gemini 2.5 Flash、GLM-4.7-FlashX、GPT-4o-mini）に対する統一インターフェースを持つ基底クラスを実装します。

**現在の状況**:
- ✅ Judgmentモデルにバイアス計算ロジックが実装済み
- ✅ JudgePostServiceのスタブが実装済み
- ❌ AI Adapterクラスは未実装
- ❌ プロンプトファイルは未作成

**目的**:
- 各AI Adapterで共通の処理（リトライ、エラーハンドリング、バイアス適用）を一箇所に集約
- E06-02〜E06-04での個別Adapter実装を容易にする

**関連Issue**: E06-01

---

## 設計概要

### アーキテクチャ

**Template Methodパターン**を採用：
- 基底クラスで処理の流れを定義
- サブクラスでAI固有の処理を実装
- 各Adapterは同じインターフェースで使用可能（Liskov置換原則）

### クラス構造

**BaseAiAdapter** (`app/adapters/base_ai_adapter.rb`):

```ruby
class BaseAiAdapter
  # 定数
  MAX_RETRIES = 3
  BASE_TIMEOUT = 30
  RETRY_DELAY = 1.0

  # 審査結果の構造体
  JudgmentResult = Struct.new(:succeeded, :error_code, :scores, :comment, keyword_init: true)

  # 公開メソッド
  def judge(post_content, persona:)
    # 1. 入力バリデーション
    # 2. リトライ処理付きでAI API呼び出し
    # 3. レスポンス解析
    # 4. ペルソナバイアス適用（既存のJudgmentモデルのメソッドを使用）
    # 5. 結果返却
  end

  private

  # 抽象メソッド（サブクラスで実装）
  def client; end           # AI APIクライアント
  def build_request; end    # APIリクエスト構築
  def parse_response; end   # レスポンス解析
end
```

### 既存資産の再利用

**Judgmentモデル** (`app/models/judgment.rb`)のクラスメソッドを使用：

```ruby
# バイアス適用
Judgment.apply_persona_bias(result.scores, persona)

# 合計点計算
Judgment.calculate_total_score(scores)
```

---

## 実装範囲

### E06-01で完了する範囲

1. `app/adapters/` ディレクトリの作成
2. `BaseAiAdapter` クラスの実装
3. `JudgmentResult` 構造体の定義
4. 共通処理の実装：
   - 入力バリデーション（post_content, persona）
   - リトライロジック（指数バックオフ、MAX_RETRIES=3）
   - エラーハンドリング（エラーコードへのマッピング）
   - ペルソナバイアス適用（Judgmentモデルのメソッドを使用）
5. Unit Testの実装

### E06-01の範囲外（E06-02〜E06-04で実装）

- 各AI Adapterの実装（`GeminiAdapter`, `GlmAdapter`, `OpenAIAdapter`）
- プロンプトファイルの作成（`app/prompts/hiroyuki.txt` 等）
- VCRを使用したインテグレーションテスト

---

## 公開インターフェース

### `judge(post_content, persona:)`

投稿を審査して結果を返します。

**引数**:
- `post_content` (String): 投稿本文（3-30文字、grapheme単位）
- `persona` (String): 審査員ID（`hiroyuki`/`dewi`/`nakao`）

**戻り値**: `JudgmentResult`構造体
- `succeeded` (Boolean): API成功/失敗
- `error_code` (String|nil): 失敗時のエラーコード
- `scores` (Hash|nil): 5項目のスコア `{empathy: Integer, humor: Integer, brevity: Integer, originality: Integer, expression: Integer}`
- `comment` (String|nil): 審査コメント

**例外**:
- `ArgumentError`: 入力が不正な場合

**処理フロー**:
1. 入力バリデーション
2. リトライ処理付きでAI API呼び出し
3. レスポンス解析
4. ペルソナバイアス適用（成功時のみ）
5. 結果返却

### エラーコード一覧

| エラーコード | 説明 | 対応例外 |
|------------|------|---------|
| `timeout` | タイムアウト | `Timeout::Error`, `Faraday::TimeoutError` |
| `connection_failed` | 接続失敗 | `Faraday::ConnectionFailed` |
| `provider_error` | プロバイダーエラー | `Faraday::ClientError`, `Faraday::ServerError` |
| `invalid_response` | レスポンス解析失敗 | `JSON::ParserError` |
| `invalid_request` | リクエスト不正 | `ArgumentError` |
| `unknown_error` | 不明なエラー | その他 |

---

## 実装計画

### Phase 1: BaseAiAdapterクラスの実装

**ファイル**: `app/adapters/base_ai_adapter.rb`

1. `app/adapters/` ディレクトリを作成
2. `BaseAiAdapter` クラスを実装
3. `JudgmentResult` 構造体を定義
4. 以下のメソッドを実装：
   - `judge` (公開メソッド)
   - `validate_inputs!`
   - `valid_personas`
   - `with_retry`
   - `call_ai_api`
   - `apply_persona_bias!` （Judgmentモデルのメソッドを使用）
   - `handle_error`
   - `map_error_to_code`
   - 抽象メソッド (`client`, `build_request`, `parse_response`)

### Phase 2: Unit Testの実装

**ファイル**: `spec/adapters/base_ai_adapter_spec.rb`

1. `spec/adapters/` ディレクトリを作成
2. テスト用の `TestAdapter` クラスを定義
3. 以下のテストケースを実装：
   - **入力バリデーション**: post_content/personaのnil/空文字/不正値
   - **リトライロジック**: タイムアウト時のリトライ、MAX_RETRIES超過時の失敗
   - **ペルソナバイアス適用**: 3種類の審査員のバイアス値
   - **エラーハンドリング**: 各種例外→エラーコードのマッピング

### Phase 3: テスト実行と検証

1. `bundle exec rspec spec/adapters/base_ai_adapter_spec.rb` でテスト実行
2. `COVERAGE=true bundle exec rspec` でカバレッジ確認（90%以上）
3. `bundle exec rubocop app/adapters/base_ai_adapter.rb` でLint確認
4. `bundle exec brakeman -q` でセキュリティスキャン

---

## テスト計画

### Unit Testで検証する項目

#### 1. 入力バリデーション

```ruby
describe '#judge' do
  context '入力バリデーション' do
    it 'post_contentがnilの場合はArgumentErrorを発生させること'
    it 'post_contentが空文字の場合はArgumentErrorを発生させること'
    it 'personaがnilの場合はArgumentErrorを発生させること'
    it '不正なpersonaの場合はArgumentErrorを発生させること'
    it '有効なpersonaの場合はバリデーションを通過すること'
  end
end
```

#### 2. リトライロジック

```ruby
describe '#judge' do
  context 'リトライ処理' do
    it 'タイムアウト時にMAX_RETRIES回までリトライすること'
    it 'MAX_RETRIES回超過で失敗すること'
    it 'リトライ時にWARNログを出力すること'
  end
end
```

#### 3. ペルソナバイアス適用

```ruby
describe '#judge' do
  context 'ペルソナバイアス適用' do
    it 'ひろゆき風のバイアスが適用されること（独創性+3、共感度-2）'
    it 'デヴィ婦人風のバイアスが適用されること（表現力+3、面白さ+2）'
    it '中尾彬風のバイアスが適用されること（面白さ+3、共感度+2）'
    it 'バイアス適用後もスコアが0-20の範囲内に収まること'
  end
end
```

#### 4. エラーハンドリング

```ruby
describe '#judge' do
  context 'エラーハンドリング' do
    it 'Timeout::Errorをtimeoutエラーコードに変換すること'
    it 'Faraday::ConnectionFailedをconnection_failedエラーコードに変換すること'
    it 'Faraday::ServerErrorをprovider_errorエラーコードに変換すること'
    it 'JSON::ParserErrorをinvalid_responseエラーコードに変換すること'
  end
end
```

### テスト用モック

```ruby
# BaseAiAdapterのテスト用モック
class TestAdapter < BaseAiAdapter
  attr_accessor :mock_client

  def client
    @mock_client ||= double('client')
  end

  def build_request(post_content, persona)
    { content: post_content, persona: persona }
  end

  def parse_response(response)
    return response if response.is_a?(JudgmentResult)

    JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: response['scores'].transform_keys(&:to_sym),
      comment: response['comment']
    )
  end
end
```

---

## 重要なファイル

### 新規作成するファイル

| ファイル | 説明 |
|---------|------|
| `app/adapters/base_ai_adapter.rb` | AI Adapter基底クラス |
| `spec/adapters/base_ai_adapter_spec.rb` | Unit Test |

### 参照する既存ファイル

| ファイル | 用途 |
|---------|------|
| `app/models/judgment.rb` | バイアス計算ロジックを呼び出し |
| `app/services/judge_post_service.rb` | E06-05でAdapterを使用 |
| `Gemfile` | Faraday等の依存関係を確認 |
| `.rubocop.yml` | コーディングルールの確認 |

---

## 確認コマンド

### テスト実行

```bash
cd /home/nukon/ws/aruaruarena/backend

# テスト実行
bundle exec rspec spec/adapters/base_ai_adapter_spec.rb

# カバレッジ確認
COVERAGE=true bundle exec rspec spec/adapters/base_ai_adapter_spec.rb
open coverage/index.html
```

**期待される結果**: すべてのテストがパスすること（XX examples, 0 failures）

### Lint確認

```bash
cd /home/nukon/ws/aruaruarena/backend

# RuboCop
bundle exec rubocop app/adapters/base_ai_adapter.rb

# セキュリティスキャン
bundle exec brakeman -q
```

---

## 実装時の注意点

### コーディングルール（CLAUDE.md準拠）

- `frozen_string_literal` を全ファイルの先頭に記述
- 日本語でコメントを記述
- メソッドは15行以内（目安）
- YARDスタイルでメソッドドキュメント（`@param`/`@return`）
- `binding.pry` を本番コードに残さない

### 依存関係

- **Faraday**: 既にGemfileに含まれている（使用推奨）
- **Judgmentモデル**: `Judgment.apply_persona_bias` クラスメソッドをそのまま使用
- **RuboCop**: `.rubocop.yml` の設定に準拠

### タイムアウト設定

Lambda環境での実行時間制限を考慮：
- **BASE_TIMEOUT**: 30秒（デフォルト）
- **リトライ回数**: 3回
- **指数バックオフ**: 1秒、2秒、3秒

3人の審査員で並列実行する場合、最大実行時間は約40秒（API呼び出し30秒 + リトライ遅延10秒以内）

---

## 次のステップ

E06-01完了後、以下を実施：
1. プルリクエストの作成
2. CodeRabbitレビューの実施
3. E06-02（Gemini Adapter）への着手

---

## 将来の拡張性

新しいAIサービスを追加する場合、基底クラスを継承するだけで簡単に追加可能：

```ruby
class ClaudeAdapter < BaseAiAdapter
  def client
    @client ||= Faraday.new('https://api.anthropic.com')
  end

  def build_request(post_content, persona)
    # Claude固有のリクエスト構築
  end

  def parse_response(response)
    # Claude固有のレスポンス解析
  end
end
```
