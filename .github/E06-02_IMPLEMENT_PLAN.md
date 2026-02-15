# E06-02: Gemini Adapterの実装

## 概要

E06「AI審査システム」の2番目のストーリーとして、Gemini 2.5 Flash APIを使用したAI Adapterを実装します。

## 目的

- Gemini 2.5 Flash APIを使用したひろゆき風審査員の実装
- BaseAiAdapterを継承した具体的なAdapterの実装例を示す
- E06-03（GLM）とE06-04（OpenAI）の実装パターンを確立

**関連Issue**: E06-02

---

## 詳細仕様

### 機能要件

**GeminiAdapterクラスの実装**:
- `BaseAiAdapter`を継承
- 抽象メソッド（`client`, `build_request`, `parse_response`, `api_key`）を実装
- ひろゆき風の審査員（独創性+3、共感度-2のバイアス）として振る舞う

**プロンプトキャッシュシステム**:
- スレッドセーフなクラスレベルのキャッシュ
- `prompt_cache`, `prompt_cache=`, `reset_prompt_cache!` メソッド

**JSON抽出ロジック**:
- マークダウンコードブロック（```json ... ```）対応
- 周囲にテキストがある場合のJSON抽出
- 生JSONフォーマット対応

**小数点スコア対応**:
- 文字列形式の小数点（"12.5"）を整数に変換（四捨五入）
- Float形式の小数点（12.5）を整数に変換（四捨五入）
- 境界値処理（0.5 → 1）

**エラーハンドリング**:
- ステータスコード別処理（200, 429, 400-499, 500-599）
- JSONパースエラー処理
- スコア変換エラー処理

**プロンプトファイルの作成**:
- `app/prompts/hiroyuki.txt` - ひろゆき風の審査プロンプト
- JSON出力形式を指定
- 5項目の審査基準（共感度、面白さ、簡潔さ、独創性、表現力）

**テストの実装**:
- Unit Test（VCR使用）
- Integration Test
- 小数点スコア変換テスト
- コードブロックJSON抽出テスト
- 周囲テキスト付きJSON抽出テスト

### 非機能要件

- API呼び出しはFaradayを使用
- タイムアウトは30秒（BaseAiAdapterのデフォルト）
- リトライは最大3回（BaseAiAdapterで実装済み）
- APIキーは環境変数から取得（`GEMINI_API_KEY`）
- SSL証明書検証を有効化
- スレッドセーフなプロンプトキャッシュ

### UI/UX設計

N/A（API専用）

---

## 技術仕様

### データモデル (DynamoDB)

| 項目 | 値 |
|------|-----|
| Table | 使用しない（Adapter層のみ） |
| PK | - |
| SK | - |
| GSI | - |

### API設計

Gemini 2.5 Flash APIを使用

| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={API_KEY}` |
| Request Body | `{"contents": [{"parts": [{"text": "プロンプト"}]}], "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1000}}` |
| Response (成功) | `{"candidates": [{"content": {"parts": [{"text": "JSON形式のスコア"}]}}]}` |
| Response (失敗) | APIエラーレスポンス |

### AIプロンプト設計

**ひろゆき風プロンプト** (`app/prompts/hiroyuki.txt`):

```
あなたは「ひろゆき風」のAI審査員として、ユーザーの「あるある」投稿を採点します。

# 審査基準（各0-20点、合計100点満点）
- 共感度: 多くの人が「あるある」と思えるか
- 面白さ: 笑いや驚きが誘われるか
- 簡潔さ: 無駄なく簡潔に表現されているか
- 独創性: 新規性や独自性があるか
- 表現力: 言葉選びや表現技巧が優れているか

# 出力形式（必ず守ること）
以下のJSON形式のみで出力。その他の文章は一切出力しないこと。

{
  "empathy": 15,
  "humor": 15,
  "brevity": 15,
  "originality": 15,
  "expression": 15,
  "comment": "短い審査コメント（30文字以内）"
}

# 投稿内容
{post_content}

上記の投稿を審査し、JSONのみを出力してください。
```

---

## テスト計画 (TDD)

### Unit Test (Model/Service)

- [x] `client`メソッド:
  - [ ] Faraday::Connectionインスタンスを返すこと
  - [ ] Gemini APIのベースURLが設定されていること
  - [ ] SSL証明書検証が有効になっていること

- [x] `build_request`メソッド:
  - [ ] 正しいリクエスト形式であること
  - [ ] プロンプトが`{post_content}`に置換されていること
  - [ ] generationConfigが正しく設定されていること

- [x] `parse_response`メソッド:
  - [ ] スコアとコメントが正しく解析されること
  - [ ] JudgmentResultが返されること
  - [ ] JSONが不正な場合はエラーになること
  - [ ] スコアが欠落している場合はエラーになること

- [x] `extract_json_from_codeblock`メソッド:
  - [ ] ```json ... ``` で囲まれたJSONを抽出できること
  - [ ] ``` ... ``` で囲まれたJSONを抽出できること
  - [ ] 周囲にテキストがある場合にJSONを抽出できること
  - [ ] コードブロックがない場合はそのまま返すこと

- [x] `convert_scores_to_integers`メソッド:
  - [ ] 文字列形式の小数点（"12.5"）を四捨五入して整数に変換できること
  - [ ] Float形式の小数点（12.5）を四捨五入して整数に変換できること
  - [ ] 境界値（0.5）が正しく丸められること
  - [ ] 不正な値の場合に例外が発生すること

- [x] `api_key`メソッド:
  - [ ] `ENV["GEMINI_API_KEY"]`を返すこと
  - [ ] APIキーが未設定の場合は例外を発生させること

- [x] プロンプトキャッシュ:
  - [ ] スレッドセーフであること
  - [ ] `reset_prompt_cache!` でリセットできること

### Request Spec (API)

- [ ] Integration Test（VCR使用）:
  - [ ] `#judge` - 正常に審査結果を返す
  - [ ] `#judge` - バイアスが適用されること
  - [ ] `#judge` - 小数点スコアが正しく処理されること
  - [ ] `#judge` - コードブロック付きJSONが正しく処理されること

### External Service (WebMock/VCR)

- [ ] VCRカセットの作成:
  - [ ] `success.yml` - 正常系
  - [ ] `timeout.yml` - タイムアウト
  - [ ] `error.yml` - APIエラー
  - [ ] `rate_limit.yml` - レート制限
  - [ ] `decimal_scores.yml` - 小数点スコア
  - [ ] `codeblock_json.yml` - コードブロック付きJSON

---

## 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** E06-01でBaseAiAdapterが実装済みである
      **When** GeminiAdapterがインスタンス化され、`judge`メソッドが呼ばれる
      **Then** 正常にJudgmentResultが返され、スコアとコメントが含まれる

- [ ] **Given** 有効な投稿内容とpersona "hiroyuki"が渡される
      **When** `judge`メソッドが呼ばれる
      **Then** ひろゆき風のバイアス（独創性+3、共感度-2）が適用されたスコアが返される

- [ ] **Given** Gemini APIが正常にレスポンスを返す
      **When** `parse_response`メソッドが呼ばれる
      **Then** JSONが正しく解析され、JudgmentResultが生成される

- [ ] **Given** APIレスポンスがコードブロックで囲まれたJSONを含む
      **When** `extract_json_from_codeblock`メソッドが呼ばれる
      **Then** JSONが正しく抽出される

- [ ] **Given** APIレスポンスのスコアが小数点を含む
      **When** `convert_scores_to_integers`メソッドが呼ばれる
      **Then** スコアが四捨五入されて整数に変換される

### 異常系 (Error Path)

- [ ] **Given** APIキーが環境変数に設定されていない
      **When** `api_key`メソッドが呼ばれる
      **Then** 例外が発生する

- [ ] **Given** Gemini APIが不正なJSONを返す
      **When** `parse_response`メソッドが呼ばれる
      **Then** エラーコード`invalid_response`が返される

- [ ] **Given** Gemini APIがタイムアウトする
      **When** `judge`メソッドが呼ばれる
      **Then** リトライが行われ、最終的にエラーコード`timeout`が返される

- [ ] **Given** Gemini APIが429ステータス（レート制限）を返す
      **When** `handle_response_status`メソッドが呼ばれる
      **Then** Faraday::ClientErrorが発生する

### 境界値 (Edge Case)

- [ ] **Given** APIレスポンスにスコアが欠落している
      **When** `parse_response`メソッドが呼ばれる
      **Then** エラーコード`invalid_response`が返される

- [ ] **Given** APIレスポンスのスコアが範囲外（0-20以外）
      **When** `parse_response`メソッドが呼ばれる
      **Then** エラーコード`invalid_response`が返される

- [ ] **Given** スコアが境界値（0.5）
      **When** `convert_scores_to_integers`メソッドが呼ばれる
      **Then** 正しく四捨五入されて1になる

---

## 関連資料

- `docs/epics.md` - E06: AI審査システム
- `.github/E06-01_IMPLEMENT_PLAN.md` - BaseAiAdapterの実装プラン
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)

---

## 実装計画

### Phase 1: プロンプトファイルの作成

**ファイル**: `app/prompts/hiroyuki.txt`

1. `app/prompts/` ディレクトリを作成
2. ひろゆき風のプロンプトを作成
3. `{post_content}` プレースホルダーを含める

### Phase 2: GeminiAdapterの実装

**ファイル**: `app/adapters/gemini_adapter.rb`

1. `GeminiAdapter` クラスを実装
2. 以下のメソッドを実装：
   - `client` - Faradayクライアントの初期化（SSL検証有効化）
   - `build_request` - Gemini APIリクエストの構築
   - `parse_response` - レスポンス解析とJudgmentResultの生成
   - `api_key` - 環境変数からのAPIキー取得
   - `extract_json_from_codeblock` - コードブロックからJSON抽出
   - `convert_scores_to_integers` - 小数点スコアを整数に変換
   - `handle_response_status` - ステータスコード別エラー処理
   - プロンプトキャッシュシステム（スレッドセーフ）

### Phase 3: BaseAiAdapterの修正

**ファイル**: `app/adapters/base_ai_adapter.rb`

1. `call_ai_api`メソッドをオーバーライド可能に変更
2. サブクラスでのHTTP通信実装を許可

### Phase 4: VCRカセットの作成

**ディレクトリ**: `spec/fixtures/vcr/gemini_adapter/`

1. VCR設定を確認（`spec/support/vcr.rb`）
2. テスト用カセットを作成:
   - `success.yml` - 正常系
   - `timeout.yml` - タイムアウト
   - `error.yml` - APIエラー
   - `rate_limit.yml` - レート制限
   - `decimal_scores.yml` - 小数点スコア
   - `codeblock_json.yml` - コードブロック付きJSON

### Phase 5: テストの実装

**ファイル**: `spec/adapters/gemini_adapter_spec.rb`

1. Unit Test（VCR使用）
2. JSON抽出テスト（コードブロック、周囲テキスト）
3. 小数点スコア変換テスト
4. エラーハンドリングテスト
5. Integration Test（実際のAPI呼び出しをモック）
6. スレッドセーフティテスト

### Phase 6: テスト実行と検証

1. `bundle exec rspec spec/adapters/gemini_adapter_spec.rb` でテスト実行
2. `COVERAGE=true bundle exec rspec` でカバレッジ確認（90%以上）
3. `bundle exec rubocop app/adapters/gemini_adapter.rb` でLint確認
4. `bundle exec brakeman -q` でセキュリティスキャン
5. CodeRabbitレビューの実施

---

## 重要なファイル

### 新規作成するファイル

| ファイル | 説明 |
|---------|------|
| `app/adapters/gemini_adapter.rb` | Gemini Adapter |
| `app/prompts/hiroyuki.txt` | ひろゆき風プロンプト |
| `spec/adapters/gemini_adapter_spec.rb` | Unit Test |
| `spec/fixtures/vcr/gemini_adapter/success.yml` | VCRカセット（正常系） |
| `spec/fixtures/vcr/gemini_adapter/timeout.yml` | VCRカセット（タイムアウト） |
| `spec/fixtures/vcr/gemini_adapter/error.yml` | VCRカセット（エラー） |
| `spec/fixtures/vcr/gemini_adapter/rate_limit.yml` | VCRカセット（レート制限） |
| `spec/fixtures/vcr/gemini_adapter/decimal_scores.yml` | VCRカセット（小数点スコア） |
| `spec/fixtures/vcr/gemini_adapter/codeblock_json.yml` | VCRカセット（コードブロックJSON） |

### 参照する既存ファイル

| ファイル | 用途 |
|---------|------|
| `app/adapters/base_ai_adapter.rb` | 継承元の基底クラス |
| `app/models/judgment.rb` | バイアス計算ロジック |
| `.env.example` | APIキー設定の確認 |
| `Gemfile` | Faradayの依存関係確認 |

---

## 確認コマンド

### テスト実行

```bash
cd /home/nukon/ws/aruaruarena

# Unit Test実行
bundle exec rspec spec/adapters/gemini_adapter_spec.rb

# カバレッジ確認
COVERAGE=true bundle exec rspec spec/adapters/gemini_adapter_spec.rb

# VCRモードの確認
# - 新規カセット作成時: VCR_RECORD=new_episodes bundle exec rspec
# - 既存カセット使用時: VCR_RECORD=none bundle exec rspec
```

**期待される結果**: すべてのテストがパスすること

### Lint確認

```bash
cd /home/nukon/ws/aruaruarena

# RuboCop
bundle exec rubocop app/adapters/gemini_adapter.rb

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

### Gemini APIの注意点

1. **Content-Type**: `application/json` を指定
2. **APIキー**: URLパラメータまたはヘッダーで渡す
3. **モデル名**: `gemini-2.0-flash-exp` を使用
4. **温度設定**: `temperature: 0.7` で安定性を確保
5. **最大トークン**: `maxOutputTokens: 1000` で十分
6. **SSL検証**: HTTPS通信で証明書検証を有効化

### JSON抽出ロジックの実装ポイント

1. **コードブロック対応**: ```json ... ``` と ``` ... ``` の両方に対応
2. **周囲テキスト対応**: コードブロックの前後にテキストがあっても抽出
3. **正規表現**: `/```json\s*\n(.*?)\n```/m` を使用
4. **フォールバック**: コードブロックがない場合はそのままJSONとして扱う

### 小数点スコア変換の実装ポイント

1. **文字列対応**: `"12.5"` → `Float("12.5")` → `13`（四捨五入）
2. **Float対応**: `12.5` → `12.5.round` → `13`
3. **境界値**: `0.5` → `1`（四捨五入）
4. **エラーハンドリング**: 不正な値の場合に `ArgumentError` を発生

### エラーハンドリングの実装ポイント

1. **ステータスコード別処理**:
   - 200-299: 成功、レスポンスを解析
   - 429: レート制限、`Faraday::ClientError` を発生
   - 400-499: クライアントエラー、`Faraday::ClientError` を発生
   - 500-599: サーバーエラー、`Faraday::ServerError` を発生
2. **JSONパースエラー**: `invalid_response` エラーコード
3. **スコア変換エラー**: `invalid_response` エラーコード
4. **ログ出力**: 適切なログレベルでエラー内容を記録

### スレッドセーフティの実装ポイント

1. **Mutex**: `@prompt_mutex` を使用した排他制御
2. **クラス変数**: `@prompt_cache` のスレッドセーフなアクセス
3. **テスト**: 並列実行でのキャッシュ競合を確認

### VCR使用時の注意点

- APIキーがカセットに含まれないようフィルタリング設定を確認
- `spec/support/vcr.rb` で敏感情報のマスキングを設定
- 小数点スコアやコードブロックJSONのカセットを別途作成

---

## 次のステップ

E06-02完了後、以下を実施：
1. プルリクエストの作成
2. CodeRabbitレビューの実施
3. E06-03（GLM Adapter）への着手

---

## 将来の拡張性

E06-02で確立したパターンをE06-03、E06-04で再利用：

```ruby
# E06-03: GLM Adapter
class GlmAdapter < BaseAiAdapter
  # 同様の構造で実装
  # - JSON抽出ロジック
  # - 小数点スコア対応
  # - エラーハンドリング
end

# E06-04: OpenAI Adapter
class OpenAIAdapter < BaseAiAdapter
  # 同様の構造で実装
  # - JSON抽出ロジック
  # - 小数点スコア対応
  # - エラーハンドリング
end
```

**再利用可能な実装パターン**:
1. コードブロックJSON抽出ロジック（`extract_json_from_codeblock`）
2. 小数点スコア変換ロジック（`convert_scores_to_integers`）
3. ステータスコード別エラーハンドリング（`handle_response_status`）
4. スレッドセーフなプロンプトキャッシュ

---

**レビュアーへの確認事項:**
- [x] 仕様の目的が明確か
- [x] DynamoDBのキー設計はアクセスパターンに適しているか（N/A）
- [x] テスト計画は正常系/異常系/境界値を網羅しているか
- [x] 受入条件はGiven-When-Then形式で記述されているか
- [x] 既存機能や他の仕様と矛盾していないか
- [x] JSON抽出ロジックの仕様が詳細に記述されているか
- [x] 小数点スコア変換の仕様が明確か
- [x] エラーハンドリングの仕様が網羅されているか
- [x] スレッドセーフティの考慮がされているか
