---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E05-06: 審査トリガー（Lambda内でThread並列実行）'
labels: 'spec, E05, backend, async'
assignees: ''
---

## 📋 概要

投稿API (`POST /api/posts`) で投稿保存後、AI審査を非同期でトリガーする機能を実装します。
Lambda環境の制約（Sidekiq等のジョブキューシステムが使えない）に対応するため、Thread.newでJudgePostServiceを非同期実行します。

> [!NOTE]
> 本issueでは**審査トリガー**のみを実装します。
> 具体的な審査ロジック（3人のAI審査員による採点）はE06で実装します。

## 🎯 目的

- **即時レスポンス**: ユーザーに対して201 Createdを即時に返す
- **非同期審査**: バックグラウンドで時間のかかるAI審査を実行
- **Lambda対応**: Lambda環境でSidekiq等が使えない制約に対応
- **エラーハンドリング**: Thread内の例外を適切に処理し、レスポンスには影響しないようにする

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P0（最優先） |
| 影響範囲 | 投稿APIの拡張（非同期審査トリガー） |
| 想定リリース | Sprint 2 / v0.2.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 1.5h |
| 前提条件 | E05-01〜E05-05完了、Judgmentモデル実装済み |

---

## 📝 詳細仕様

### 機能要件

#### 1. 非同期審査のトリガー

投稿保存成功後、以下の処理を非同期で実行する：

```ruby
Thread.new do
  begin
    JudgePostService.call(post.id)
  rescue => e
    Rails.logger.error("[JudgePostService] Failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.join("\n")) if Rails.env.development?
  end
end
```

**要件**:
- Thread.newでJudgePostService.callを非同期実行
- Thread内の例外はログに出力のみ、レスポンスには影響しない
- メインスレッドは即時にレスポンスを返す

#### 2. JudgePostServiceのインターフェース（スタブ）

本issueではスタブ実装を行う：

```ruby
class JudgePostService
  def self.call(post_id)
    new(post_id).execute
  end

  def initialize(post_id)
    @post = Post.find(post_id)
  end

  def execute
    # TODO: E06-05で実装
    # 1. 3人のAI審査員による並列審査
    # 2. 審査結果のJudgmentテーブルへの保存
    # 3. 投稿ステータスの更新（judging → scored/failed）
    Rails.logger.warn("[JudgePostService] Not implemented yet (E06-05)")
  end
end
```

**要件**:
- `self.call(post_id)` クラスメソッドを提供
- `execute` インスタンスメソッドで審査を実行
- E06-05まではスタブとしてWARNレベルのログを出力

#### 3. PostsControllerの変更

**変更前**:
```ruby
def create
  post = Post.new(post_params.merge(id: SecureRandom.uuid))

  if post.save
    render json: { id: post.id, status: post.status }, status: :created
  else
    render_validation_error(post)
  end
rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
  render_bad_request
end
```

**変更後**:
```ruby
def create
  post = Post.new(post_params.merge(id: SecureRandom.uuid))

  if post.save
    # 非同期で審査を開始
    Thread.new { JudgePostService.call(post.id) }

    render json: { id: post.id, status: post.status }, status: :created
  else
    render_validation_error(post)
  end
rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
  render_bad_request
end
```

**変更点**:
- 投稿保存成功後にThread.newでJudgePostService.callを非同期実行
- Thread.newはブロックしないため、即時にレスポンスを返す

### 非機能要件

#### 1. レスポンス時間

- **目標**: P95で50ms以内（投稿リクエストからレスポンスまで）
- **測定**: CloudWatch Insightsで `duration` フィールドを確認
- **理由**: AI審査は数秒かかるため、非同期化でUXを向上

#### 2. エラーハンドリング

**Thread内の例外**:
- ログレベル: ERROR
- フォーマット: `[JudgePostService] Failed: #{error.class} - #{error.message}`
- バックトレース: development環境のみ出力
- レスポンス: 影響しない（201 Createdを返す）

**ユーザーへの影響**:
- Thread内で例外が発生しても、投稿は保存される
- 審査が失敗した場合は、次回のリクエストで再審査（E11で実装）

#### 3. スレッドセーフティ

- DynamoDBへのアクセスはDynamoidがスレッドセーフ
- Post/Judgmentモデルへのアクセスはスレッドセーフ（Dynamoidの責任）

#### 4. Lambda環境の考慮事項

**制約**:
- Sidekiq等のジョブキューシステムが使えない
- タイムアウト: 30秒（terraform/lambda.tfで設定）
- メモリ: 512MB

**対策**:
- Thread.newで簡易的な非同期処理を実現
- JudgePostService内でAPI呼び出しのタイムアウトを管理（E06で実装）
- Thread自体にはタイムアウトを設定しない（Lambdaの制限時間内で実行）

### UI/UX設計

N/A（API専用）

フロントエンド側（E13）では、審査中画面を表示し、3秒ごとにGET /api/posts/:idでポーリングして審査完了を待機します。

---

## 🔧 技術仕様

### データモデル (DynamoDB)

**posts テーブル**:
| 項目 | 値 |
|------|-----|
| Table | `aruaruarena-posts` |
| PK | `id` (UUID) |
| status | `"judging"` → `"scored"` / `"failed"` （JudgePostServiceで更新） |
| judges_count | 成功した審査員数（0-3） |

**judgments テーブル**:
| 項目 | 値 |
|------|-----|
| Table | `aruaruarena-judgments` |
| PK | `post_id` |
| SK | `persona` (hiroyuki/dewi/nakao) |
| succeeded | API成功/失敗 |
| scores | {empathy, humor, brevity, originality, expression} |
| total_score | 合計点（0-100） |
| comment | 審査コメント |

### API設計

**変更なし**: POST /api/posts のリクエスト/レスポンス形式は変更ありません。

| 項目 | 値 |
|------|-----|
| Method | `POST` |
| Path | `/api/posts` |
| Request | `{ "post": { "nickname": "太郎", "body": "スヌーズ押して二度寝" } }` |
| Response | `201 Created` `{ "id": "uuid", "status": "judging" }` |

**内部処理の変更**:
- 投稿保存後にThread.newでJudgePostService.callを非同期実行
- ユーザーには即時にレスポンスを返す

### Thread設計

| 項目 | 値 |
|------|-----|
| 実行方式 | `Thread.new { JudgePostService.call(post.id) }` |
| 例外処理 | Thread内でrescueし、ログに出力 |
| タイムアウト | なし（Lambdaの制限時間内で実行） |
| デタッチメント | デタッチ済み（メインスレッドは即時復帰） |

### AIプロンプト設計

N/A（E06で実装）

---

## 🧪 テスト計画 (TDD)

### Unit Test (Service)

**spec/services/judge_post_service_spec.rb**:

#### 正常系
- [ ] `call` クラスメソッドでインスタンスを生成しexecuteを呼ぶこと
- [ ] `initialize` でpost_idからPostを取得すること
- [ ] `execute` でWARNレベルのログを出力すること（スタブ）

#### 異常系
- [ ] 存在しないpost_idで初期化するとエラーになること

### Request Spec (API)

**spec/requests/api/posts_spec.rb**:

#### Thread検証
- [ ] 投稿成功時にThreadが生成されること
- [ ] JudgePostService.callが呼び出されること
- [ ] レスポンスが即時に返ること（Thread完了を待たない）

**実装方法**:
```ruby
it '投稿成功時にJudgePostServiceが非同期で呼び出されること' do
  allow(JudgePostService).to receive(:call).and_call_original

  expect {
    post '/api/posts', params: valid_params.to_json, headers: valid_headers
  }.to change(Thread.list, :size).by(1) # Threadが増える

  expect(JudgePostService).to have_received(:call).with(post_id)
end
```

### External Service (WebMock/VCR)

- モック対象: なし（本issueではThreadとJudgePostServiceスタブのみ）

---

## 📊 Example Mapping

| シナリオ | 期待動作 |
|----------|----------|
| 投稿成功 | 201 Created + Thread.newでJudgePostService.call実行 |
| Thread内で例外発生 | ログERROR出力 + レスポンスは201 Created |
| JudgePostService未実装 | WARNログ出力 + statusはjudgingのまま |

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** 有効なニックネームと本文がある
      **When** `POST /api/posts` にリクエストを送信する
      **Then** HTTPステータス `201 Created` が返り、`{ id: "uuid", status: "judging" }` 形式のレスポンスが返る
      **And** `JudgePostService.call` がThread.newで非同期実行される

- [ ] **Given** Thread.newでJudgePostServiceが実行される
      **When** JudgePostServiceのexecuteメソッドが呼ばれる
      **Then** WARNレベルのログ `[JudgePostService] Not implemented yet (E06-05)` が出力される

### 異常系 (Error Path)

- [ ] **Given** Thread内でJudgePostServiceの実行中に例外が発生する
      **When** 例外がraiseされる
      **Then** ERRORレベルのログ `[JudgePostService] Failed: ...` が出力される
      **And** レスポンスには影響せず、201 Createdが返る

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | `.github/E05-06_ISSUE_DRAFT.md` の作成 | 15分 |
| Phase 2 | REDテスト作成（Service Unit + Request Spec） | 20分 |
| Phase 3 | GREEN実装（JudgePostServiceスタブ + Thread追加） | 20分 |
| Phase 4 | REFACTOR（ログ出力フォーマット調整） | 10分 |
| Phase 5 | RuboCop確認 | 5分 |
| Phase 6 | コードレビュー対応 | 10分 |
| **合計** | | **1時間20分** |

### 依存関係

**前提条件となるIssue:**
- E05-01〜E05-05（投稿APIの基盤） ✅ 完了
- E03-07（Judgmentモデル実装） ✅ 完了

**後続のIssue:**
- E06-01〜E06-04（AI Adapterの実装）: 本issueのJudgePostServiceを拡張
- E06-05（JudgePostServiceの実装）: 本issueのスタブを本実装に置き換え
- E06-06（審査結果のDynamoDB保存）: JudgePostService内で実装
- E06-07（ステータス更新）: JudgePostService内で実装

**関連Epic（依存関係）:**
- E06（AI審査システム）: 本issueのJudgePostServiceスタブを本実装

---

## 🔗 関連資料

- DB設計書: `docs/db_schema.md`
- Epicリスト: `docs/epics.md`（E05: 投稿API、E06: AI審査システム）
- 既存モデル: `backend/app/models/post.rb`、`backend/app/models/judgment.rb`
- Lambda設定: `backend/terraform/lambda.tf`

---

**レビュアーへの確認事項:**

- [ ] 仕様の目的が明確か（即時レスポンス + 非同期審査）
- [ ] Thread.newでの非同期実行はLambda環境の制約に適しているか
- [ ] Thread内の例外処理は適切か（ログ出力のみ、レスポンスには影響しない）
- [ ] JudgePostServiceのスタブ実装で良いか（本実装はE06-05）
- [ ] テスト計画はThreadの生成とJudgePostServiceの呼び出しを検証しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] E06（AI審査システム）との依存関係は明確か
