---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E05-01: 投稿バリデーション（ニックネーム1-20文字、本文3-30文字）'
labels: 'spec, E05, backend, validation'
assignees: ''
---

## 📋 概要

投稿API (`POST /api/posts`) のリクエストバリデーションを実装する。
ニックネーム（1-20文字）と本文（3-30文字、grapheme単位）の入力検証を行い、
不正な入力に対して統一エラーフォーマットで適切なエラーレスポンスを返す。

> [!NOTE]
> Postモデル (`backend/app/models/post.rb`) にはバリデーションが**実装済み**。
> 本issueではコントローラーレイヤーでのリクエストバリデーション・エラーハンドリングと、
> モデルバリデーションとの連携を仕様として確定し、テスト駆動で実装する。

## 🎯 目的

- **入力の安全性確保**: 不正な投稿データがDynamoDBに保存されることを防ぐ
- **ユーザー体験向上**: わかりやすいエラーメッセージで入力修正を促す
- **統一エラーフォーマット**: `{ error: "...", code: "..." }` 形式でフロントエンドとの連携を標準化
- **grapheme単位の正確なカウント**: 絵文字・結合文字・修飾子を正しく1文字としてカウント

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P0（最優先） |
| 影響範囲 | 新機能（投稿APIの入力検証） |
| 想定リリース | Sprint 2 / v0.2.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 2h |
| 前提条件 | E03 完了（DynamoDBスキーマ定義・Postモデル実装済み） |

---

## 📝 詳細仕様

### 機能要件

#### 1. ニックネームバリデーション

| 項目 | ルール |
|------|--------|
| 必須 | 必須（空文字・nil不可） |
| 最小文字数 | 1文字 |
| 最大文字数 | 20文字 |
| 文字種制限 | なし（日本語・英数字・絵文字すべて許可） |
| 空白処理 | 前後の半角空白（U+0020）・全角空白（U+3000）はstrip |
| 表示ルール | 8文字超は省略表示（フロントエンド側で処理） |

#### 2. 本文バリデーション

| 項目 | ルール |
|------|--------|
| 必須 | 必須（空文字・nil不可） |
| 最小文字数 | 3文字（grapheme単位） |
| 最大文字数 | 30文字（grapheme単位） |
| 文字種制限 | なし（日本語・英数字・絵文字すべて許可） |
| カウント方式 | `String#grapheme_clusters.length`（Ruby標準） |
| 空白処理 | 前後の半角空白（U+0020）・全角空白（U+3000）はstrip |
| 内部空白 | 連続空白・タブ・改行はそのまま保持 |

> [!IMPORTANT]
> grapheme単位のカウントにより、以下の文字を正しく1文字としてカウントします：
> - 絵文字（😀😀😀）
> - 結合絵文字（👨‍👩‍👧‍👦 等、ZWJで結合された文字）
> - 絵文字修飾子（👨🏻‍💻 等、肌色バリエーション）
> - 異体セレクタ（㊷︠ 等）
>
> Ruby 2.5+の `String#grapheme_clusters` を使用。

#### 3. エラーレスポンス仕様

**HTTP Status Code**: `422 Unprocessable Entity`

```json
{
  "error": "バリデーションエラーの内容",
  "code": "VALIDATION_ERROR"
}
```

**エラーメッセージ一覧**:

| 条件 | エラーメッセージ |
|------|------------------|
| ニックネーム未入力 | `ニックネームを入力してください` |
| ニックネーム21文字以上 | `ニックネームは20文字以内で入力してください` |
| 本文未入力 | `本文を入力してください` |
| 本文2文字以下 | `本文は3〜30文字で入力してください` |
| 本文31文字以上 | `本文は3〜30文字で入力してください` |
| 複数エラー | 最初のエラーのみ返す（優先順位: nickname → body） |

> [!NOTE]
> 将来的な拡張案（本issueのスコープ外）:
> - 配列形式で複数エラーを返す設計も検討可能: `{"errors": [{"field": "nickname", "message": "..."}]}`
> - フロントエンド側で並列表示する場合は E12 で調整

#### 4. 正常レスポンス仕様

**HTTP Status Code**: `201 Created`

```json
{
  "id": "uuid-string",
  "status": "judging"
}
```

#### 5. コントローラー設計

```ruby
# app/controllers/api/posts_controller.rb
module Api
  class PostsController < ApplicationController
    def create
      post = Post.new(post_params)

      unless post.valid?
        # 優先順位を明示的に制御: nickname → body → その他
        error_message = post.errors[:nickname].first || post.errors[:body].first || post.errors.full_messages.first
        render json: {
          error: error_message,
          code: 'VALIDATION_ERROR'
        }, status: :unprocessable_entity
        return
      end

      post.save!
      render json: { id: post.id, status: post.status }, status: :created
    rescue ActionController::ParameterMissing
      render json: { error: 'リクエスト形式が正しくありません', code: 'BAD_REQUEST' }, status: :bad_request
    end

    private

    def post_params
      params.require(:post).permit(:nickname, :body)
    end
  end
end
```

#### 6. Strong Parametersの制約

- `nickname` と `body` のみ許可
- 不明なパラメータは無視（例: `status`, `average_score` 等は受け付けない）
- NoSQLインジェクション対策として、許可パラメータを明示

#### 7. 入力前処理（サニタイゼーション）

```ruby
# app/models/post.rb に追加
before_validation :sanitize_inputs

def sanitize_inputs
  self.nickname = nickname&.gsub(/\A[ \u3000]+|[ \u3000]+\z/, '') # 前後の半角・全角空白のみ除去
  self.body = body&.gsub(/\A[ \u3000]+|[ \u3000]+\z/, '')
end
```

**処理内容**:
- 前後の半角空白（U+0020）を削除
- 前後の全角空白（U+3000）も削除
- 内部の連続空白はそのまま保持

### 非機能要件

- **レスポンス速度**: P95で10ms以内（AWS Lambda 128MB環境、CloudWatch Insightsで測定）
- **セキュリティ**:
  - NoSQLインジェクション対策（Strong Parametersで許可パラメータを明示）
  - 未知のパラメータは無視（Mass Assignment防止）
  - HTMLタグ・JavaScriptコードの保存は許可（表示時はReactで自動エスケープ）
- **ログ**:
  - バリデーションエラー時はWARNレベルでログ出力
  - フォーマット: `[PostController] Validation failed: nickname=#{nickname}, body=#{body}, errors=#{errors.full_messages.join(', ')}`
  - 出力先: CloudWatch Logs（Lambda環境）/ 標準出力（ローカル開発）

### UI/UX設計

N/A（API専用、フロントエンドバリデーションは E12 で実装）

- フロントエンド側でも同様のバリデーションを実装予定（E12: 投稿フォーム）
- **二重バリデーション**: フロントエンド（UX向上）+ バックエンド（データ保全）

---

## 🔧 技術仕様

### データモデル (DynamoDB)

| 項目 | 値 |
|------|-----|
| Table | `aruaruarena-posts` |
| PK | `id` (UUID, 自動生成) |
| SK | なし |
| GSI | `RankingIndex` (status, score_key) ※本issueでは未使用 |

### バリデーション対象フィールド

| フィールド | 型 | バリデーション | 備考 |
|-----------|-----|---------------|------|
| `nickname` | String | presence, length(1..20) | 実装済み（post.rb） |
| `body` | String | presence, grapheme_length(3..30) | 実装済み（post.rb） |
| `status` | String | presence, inclusion | デフォルト値`judging`で自動設定 |
| `id` | String | presence | UUID自動生成 |
| `created_at` | String | presence | UnixTimestampを文字列として保存（例: "1738041600"） |

> [!IMPORTANT]
> `created_at` は **String型** として保存します（既存実装との整合性）。

### API設計

| 項目 | 値 |
|------|-----|
| Method | `POST` |
| Path | `/api/posts` |
| Request Headers | `Content-Type: application/json` |
| Request Body | `{ "post": { "nickname": "太郎", "body": "スヌーズ押して二度寝" } }` |
| Response (成功) | `201 Created` `{ "id": "uuid", "status": "judging" }` |
| Response (失敗) | `422 Unprocessable Entity` `{ "error": "...", code: "VALIDATION_ERROR" }` |
| Response (不正なJSON) | `400 Bad Request` `{ "error": "リクエスト形式が正しくありません", code: "BAD_REQUEST" }` |
| Response (不正なContent-Type) | `415 Unsupported Media Type` |

### ルーティング

```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    resources :posts, only: [:create]
  end
end
```

### ログ設計

| 項目 | 値 |
|------|-----|
| レベル | WARN |
| フォーマット | `[PostController] Validation failed: nickname=#{nickname}, body=#{body}, errors=#{errors.full_messages.join(', ')}` |
| 出力先 | CloudWatch Logs（Lambda環境）/ 標準出力（ローカル開発） |

### AIプロンプト設計

N/A

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model)

#### 正常系
- [ ] ニックネーム1文字で有効（境界値下限）
- [ ] ニックネーム20文字で有効（境界値上限）
- [ ] 本文3文字（grapheme）で有効（境界値下限）
- [ ] 本文30文字（grapheme）で有効（境界値上限）
- [ ] 日本語のニックネームで有効
- [ ] 絵文字を含む本文で有効（grapheme単位カウント）
- [ ] ニックネーム・本文の前後空白がstripされること
- [ ] 全角空白がstripされること

#### 異常系
- [ ] ニックネーム空文字で無効
- [ ] ニックネームnilで無効
- [ ] ニックネーム21文字で無効
- [ ] 本文空文字で無効
- [ ] 本文nilで無効
- [ ] 本文2文字（grapheme）で無効
- [ ] 本文31文字（grapheme）で無効

#### 境界値
- [ ] ニックネーム1文字と2文字の境界
- [ ] ニックネーム20文字と21文字の境界
- [ ] 本文3文字と2文字の境界（grapheme）
- [ ] 本文30文字と31文字の境界（grapheme）
- [ ] 結合絵文字（👨‍👩‍👧‍👦）が1 graphemeとしてカウントされること
- [ ] 絵文字修飾子（👨🏻‍💻）が1 graphemeとしてカウントされること
- [ ] 空白のみの入力（strip後に空文字になる場合）

### Request Spec (API)

#### 正常系
- [ ] `POST /api/posts` - 正常投稿（201 Created, `{ id, status }` 返却）
- [ ] `POST /api/posts` - 最小値で投稿成功
- [ ] `POST /api/posts` - 最大値で投稿成功
- [ ] `POST /api/posts` - 絵文字を含む投稿成功
- [ ] `POST /api/posts` - 結合絵文字を含む投稿成功

#### 異常系
- [ ] `POST /api/posts` - ニックネーム未入力（422, VALIDATION_ERROR）
- [ ] `POST /api/posts` - ニックネーム超過（422, VALIDATION_ERROR）
- [ ] `POST /api/posts` - 本文未入力（422, VALIDATION_ERROR）
- [ ] `POST /api/posts` - 本文文字数不足（422, VALIDATION_ERROR）
- [ ] `POST /api/posts` - 本文文字数超過（422, VALIDATION_ERROR）
- [ ] `POST /api/posts` - 不正パラメータ無視（status等が含まれても無視）
- [ ] `POST /api/posts` - 不正なJSON形式（400, BAD_REQUEST）
- [ ] `POST /api/posts` - Content-Type: text/html（415 Unsupported Media Type）
- [ ] `POST /api/posts` - リクエストボディが空（400, BAD_REQUEST）

#### エッジケース
- [ ] `POST /api/posts` - 空白のみのnickname
- [ ] `POST /api/posts` - 空白のみのbody
- [ ] `POST /api/posts` - 全角空白のみのnickname
- [ ] `POST /api/posts` - 全角空白のみのbody
- [ ] `POST /api/posts` - 複数エラー時の優先順位（nickname優先）

### External Service (WebMock/VCR)

- モック対象: DynamoDB（Dynamoid経由、テスト環境ではDynamoDB Local使用）

---

## 📊 Example Mapping

| シナリオ | nickname | body | 期待ステータス | 期待レスポンス |
|----------|----------|------|----------------|----------------|
| 正常投稿 | "太郎" | "スヌーズ押して二度寝" | 201 | `{ id: "uuid", status: "judging" }` |
| 正常投稿（最小値） | "A" | "ABC" | 201 | `{ id: "uuid", status: "judging" }` |
| 正常投稿（最大値） | "12345678901234567890" | "123456789012345678901234567890" | 201 | `{ id: "uuid", status: "judging" }` |
| 正常投稿（絵文字） | "😀太郎" | "😀😀😀" | 201 | `{ id: "uuid", status: "judging" }` |
| 正常投稿（結合絵文字） | "太郎" | "👨‍👩‍👧‍👦テスト投稿" | 201 | `{ id: "uuid", status: "judging" }` |
| 正常投稿（絵文字修飾子） | "太郎" | "👨🏻‍💻👨🏻‍💻👨🏻‍💻" | 201 | `{ id: "uuid", status: "judging" }` |
| nickname空文字 | "" | "テスト投稿" | 422 | `{ error: "ニックネームを入力してください", code: "VALIDATION_ERROR" }` |
| nicknameなし | (なし) | "テスト投稿" | 422 | `{ error: "リクエスト形式が正しくありません", code: "BAD_REQUEST" }` |
| nickname21文字 | "123456789012345678901" | "テスト投稿" | 422 | `{ error: "...", code: "VALIDATION_ERROR" }` |
| body空文字 | "太郎" | "" | 422 | `{ error: "本文を入力してください", code: "VALIDATION_ERROR" }` |
| bodyなし | "太郎" | (なし) | 422 | `{ error: "リクエスト形式が正しくありません", code: "BAD_REQUEST" }` |
| body2文字 | "太郎" | "AB" | 422 | `{ error: "本文は3〜30文字で入力してください", code: "VALIDATION_ERROR" }` |
| body31文字 | "太郎" | "1234567890123456789012345678901" | 422 | `{ error: "本文は3〜30文字で入力してください", code: "VALIDATION_ERROR" }` |
| 空白のみのnickname | "   " | "テスト投稿" | 422 | `{ error: "ニックネームを入力してください", code: "VALIDATION_ERROR" }` |
| 空白のみのbody | "太郎" | "   " | 422 | `{ error: "本文を入力してください", code: "VALIDATION_ERROR" }` |
| 全角空白のみのnickname | "　　" | "テスト投稿" | 422 | `{ error: "ニックネームを入力してください", code: "VALIDATION_ERROR" }` |
| 全角空白のみのbody | "太郎" | "　　" | 422 | `{ error: "本文を入力してください", code: "VALIDATION_ERROR" }` |
| 不正パラメータ含む | "太郎" | "テスト投稿" (+status: "scored") | 201 | statusは無視され`judging`で保存 |
| 複数エラー | "" | "" | 422 | nicknameのエラーが優先して返る |
| 不正なJSON | (不正なJSON形式) | (N/A) | 400 | `{ error: "リクエスト形式が正しくありません", code: "BAD_REQUEST" }` |

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** 有効なニックネーム（1-20文字）と有効な本文（3-30文字）が入力されている
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `201 Created` が返り、`{ id: "uuid", status: "judging" }` 形式のレスポンスが返る

- [ ] **Given** 日本語のニックネーム「太郎」と本文「スヌーズ押して二度寝」が入力されている
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 投稿が正常に保存され、UUIDが返される

- [ ] **Given** ニックネームが1文字（境界値下限）で本文が3文字（境界値下限）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 投稿が正常に保存される

- [ ] **Given** ニックネームが20文字（境界値上限）で本文が30文字（境界値上限）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 投稿が正常に保存される

- [ ] **Given** 本文に絵文字（😀😀😀）が含まれている（3 grapheme）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** grapheme単位で3文字としてカウントされ、投稿が正常に保存される

- [ ] **Given** 本文に結合絵文字（👨‍👩‍👧‍👦）が含まれている
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 結合絵文字が1 graphemeとしてカウントされ、投稿が正常に保存される

- [ ] **Given** ニックネームと本文の前後に空白がある
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 前後の空白がstripされて保存される

- [ ] **Given** ニックネームと本文の前後に全角空白がある
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 前後の全角空白もstripされて保存される

### 異常系 (Error Path)

- [ ] **Given** ニックネームが空文字
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `422` が返り、`{ error: "ニックネームを入力してください", code: "VALIDATION_ERROR" }` が返る

- [ ] **Given** ニックネームが21文字
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `422` が返り、`{ error: "...", code: "VALIDATION_ERROR" }` が返る

- [ ] **Given** 本文が空文字
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `422` が返り、`{ error: "本文を入力してください", code: "VALIDATION_ERROR" }` が返る

- [ ] **Given** 本文が2文字（grapheme単位）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `422` が返り、`{ error: "本文は3〜30文字で入力してください", code: "VALIDATION_ERROR" }` が返る

- [ ] **Given** 本文が31文字（grapheme単位）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `422` が返り、`{ error: "本文は3〜30文字で入力してください", code: "VALIDATION_ERROR" }` が返る

- [ ] **Given** リクエストボディにstatusパラメータが含まれている
      **When** `POST /api/posts` にリクエストを送信する
      **Then** Strong Parametersによりstatusは無視され、デフォルト値`judging`で保存される

- [ ] **Given** 不正なJSON形式のリクエストボディ
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `400` が返り、`{ error: "リクエスト形式が正しくありません", code: "BAD_REQUEST" }` が返る

- [ ] **Given** Content-Type: text/html でリクエスト
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `415 Unsupported Media Type` が返る

### 境界値 (Edge Case)

- [ ] **Given** 結合絵文字（👨‍👩‍👧‍👦）を含む本文（合計3 grapheme以上）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 結合絵文字が1 graphemeとしてカウントされ、正常に保存される

- [ ] **Given** 絵文字修飾子（👨🏻‍💻）を含む本文
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 修飾子付き絵文字が1 graphemeとしてカウントされ、正常に保存される

- [ ] **Given** ニックネームが空白のみ（"   "）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** strip後に空文字となり、バリデーションエラーが返る

- [ ] **Given** ニックネームが全角空白のみ（"　　"）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 全角空白もstrip後に空文字となり、バリデーションエラーが返る

- [ ] **Given** 本文が空白のみ（"   "）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** strip後に空文字となり、バリデーションエラーが返る

- [ ] **Given** 本文が全角空白のみ（"　　"）
      **When** `POST /api/posts` にリクエストを送信する
      **Then** 全角空白もstrip後に空文字となり、バリデーションエラーが返る

- [ ] **Given** マルチバイト文字混在（日本語+絵文字+英数字）の本文
      **When** `POST /api/posts` にリクエストを送信する
      **Then** grapheme単位で正しくカウントされ、範囲内であれば正常に保存される

- [ ] **Given** ニックネームと本文の両方がバリデーションエラー
      **When** `POST /api/posts` にリクエストを送信する
      **Then** ニックネームのエラーが優先して返る

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | REDテスト作成（モデルUnit + Request Spec） | 30分 |
| Phase 2 | GREEN実装（コントローラー + ルーティング + sanitize） | 30分 |
| Phase 3 | REFACTOR（エラーメッセージ調整、共通エラーハンドリング） | 20分 |
| Phase 4 | 追加テスト（境界値・grapheme・空白処理・不正JSON） | 25分 |
| Phase 5 | RuboCop + Brakeman確認 | 10分 |
| Phase 6 | コードレビュー対応 | 15分 |
| **合計** | | **2時間10分** |

### 依存関係

**前提条件となるIssue:**
- E03（DynamoDBスキーマ定義） ✅ 完了
- E03-07（Dynamoidモデル実装） ✅ 完了

**後続のIssue:**
- E05-02（DynamoDBへの投稿保存）: 本issueのコントローラーを拡張
- E05-03（UUID生成・レスポンス返却）: 本issueのレスポンス形式を基盤に利用
- E05-05（RSpecテスト）: 本issueのテストを基盤に追加

**関連Epic（依存関係）:**
- E09（レート制限・スパム対策）: E05完了後に実装し、本issueのコントローラー前に割り込ませる

---

## 🔗 関連資料

- DB設計書: `docs/db_schema.md`
- 画面設計書: `docs/screen_design.md`
- Epicリスト: `docs/epics.md`（E05: 投稿API）
- 既存モデル: `backend/app/models/post.rb`（バリデーション実装済み）
- 既存テスト: `backend/spec/models/post_spec.rb`
- API仕様: `docs/epics.md` E05セクション

---

## 📊 Phase 2完了チェック（技術設計確定）

- [ ] AIとの壁打ち設計を完了
- [ ] 設計レビューを実施
- [ ] 全ての不明点を解決
- [ ] このIssueに技術仕様を書き戻し完了

---

**レビュアーへの確認事項:**

- [ ] 仕様の目的が明確か
- [ ] バリデーションルール（nickname: 1-20, body: 3-30 grapheme）は要件通りか
- [ ] エラーレスポンスのHTTPステータスコード（422）は適切か
- [ ] エラーフォーマット `{ error, code }` はフロントエンドの期待と一致しているか
- [ ] Strong Parametersで `nickname` と `body` のみ許可は適切か
- [ ] grapheme単位カウントの必要性と実装方法は妥当か
- [ ] 前後空白のstrip処理（半角・全角）は要件として正しいか
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 既存のPostモデルバリデーションとの整合性が取れているか
- [ ] E05-02以降のissueとの依存関係は明確か
- [ ] `created_at` のString型仕様は既存実装と整合しているか
- [ ] 不正なJSON/Content-Typeのハンドリング仕様は適切か
