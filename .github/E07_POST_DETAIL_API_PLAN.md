# E07: 投稿詳細API実装プラン

## 📋 概要

E07は「投稿詳細API」の実装です。投稿詳細と審査状況を取得する `GET /api/posts/:id` エンドポイントを実装します。

---

## 🎯 目的

- 投稿の詳細情報を取得するAPIを提供
- 3人のAI審査員の結果を結合して返す
- ランキング順位を計算して含める

---

## 📝 詳細仕様

### 機能要件

- [x] E07-01: 投稿詳細取得の実装
- [ ] E07-02: 審査結果の結合
- [ ] E07-03: ランキング順位の計算
- [ ] E07-04: RSpecテスト（正常系・異常系）

### 非機能要件

- N+1クエリの回避（Judgmentの事前読み込み）
- 適切なエラーハンドリング
- レスポンス時間: 500ms以内
- ログ出力: エラー発生時にERRORレベルでログ出力（投稿ID・エラー内容を含む）

### UI/UX設計

API専用のため N/A

---

## 🔧 技術仕様

### データモデル (DynamoDB)

| 項目 | 値 |
|------|-----|
| Table | aruaruarena-posts, aruaruarena-judgments |
| PK (posts) | id (UUID) |
| PK (judgments) | post_id |
| SK (judgments) | persona (hiroyuki / dewi / nakao) |
| GSI (posts) | RankingIndex (PK: status, SK: score_key) |

> [!NOTE]
> postsテーブルのGSIは `RankingIndex`（PK: status, SK: score_key）であり、score_keyのみではない。
> `calculate_rank` メソッドは `status = scored` かつ `score_key < 自分のscore_key` でクエリする。

### API設計

| 項目 | 値 |
|------|-----|
| Method | GET |
| Path | /api/posts/:id |
| Request Body | なし |
| Response (成功) | 以下のJSON形式 |
| Response (失敗) | `{ "error": "...", "code": "..." }` |

#### 成功レスポンス形式

> [!IMPORTANT]
> `epics.md` のレスポンス形式と統一すること。以下の差分に注意:
> - `epics.md` には `total_count` フィールド（全scored投稿数）がある → プランにも追加
> - `epics.md` では `success` を使用、プランでは `succeeded` を使用 → DB設計の `succeeded` に合わせる
> - `epics.md` には `status` / `judges_count` フィールドがない → プランの方が詳細
> - `epics.md` には `scores` ネスト構造がない（フラット） → epics.mdのフラット構造の方が冗長性が低い
>
> **→ 以下の形式を正とする（DB設計に準拠しつつ、epics.mdの`total_count`を追加）**

````json
{
  "id": "uuid",
  "nickname": "太郎",
  "body": "スヌーズ押して二度寝",
  "average_score": 85.3,
  "rank": 12,
  "total_count": 500,
  "status": "scored",
  "judges_count": 3,
  "judgments": [
    {
      "persona": "hiroyuki",
      "succeeded": true,
      "empathy": 15,
      "humor": 18,
      "brevity": 16,
      "originality": 17,
      "expression": 19,
      "total_score": 85,
      "comment": "あるあるすぎて笑った"
    },
    {
      "persona": "dewi",
      "succeeded": true,
      "empathy": 16,
      "humor": 19,
      "brevity": 15,
      "originality": 18,
      "expression": 20,
      "total_score": 88,
      "comment": "素晴らしい表現力ね"
    },
    {
      "persona": "nakao",
      "succeeded": true,
      "empathy": 17,
      "humor": 20,
      "brevity": 14,
      "originality": 16,
      "expression": 16,
      "total_score": 83,
      "comment": "うん、いい味出してる"
    }
  ]
}
````

#### 失敗時の審査結果レスポンス形式

> [!IMPORTANT]
> `succeeded: false` の審査結果には `error_code` を含める。
> スコア関連フィールド（empathy, humor等）は `null` とする。

````json
{
  "persona": "dewi",
  "succeeded": false,
  "error_code": "timeout",
  "empathy": null,
  "humor": null,
  "brevity": null,
  "originality": null,
  "expression": null,
  "total_score": null,
  "comment": null
}
````

#### 失敗レスポンス形式

| ケース | HTTP Status | error | code |
|--------|-------------|-------|------|
| 存在しない投稿ID | 404 | 投稿が見つかりません | NOT_FOUND |
| 不正なUUID形式 | 404 | 投稿が見つかりません | NOT_FOUND |
| サーバーエラー | 500 | サーバーエラーが発生しました | INTERNAL_ERROR |

---

## 🏗️ 実装方針

### コントローラー設計（15行以内制約）

`PostsController#show` は CLAUDE.md の「1メソッド15行以内」に収める必要がある。
レスポンスのJSON構築ロジックが複雑になるため、**モデルに `to_detail_json` メソッドを定義**してコントローラーを簡潔に保つ。

#### 方針A: モデルにto_detail_json追加（採用）

`show` アクション内で:
1. `Post.find(id)` で投稿取得
2. `post.judgments.to_a` でJudgment一括取得
3. `post.calculate_rank` で順位計算
4. `Post.total_scored_count` でtotal_count取得
5. `post.to_detail_json(rank, total_count)` でJSON構築
6. `render json:` でレスポンス返却

#### 方針B: サービスオブジェクト導入（不採用）

`FetchPostDetailService.call(post_id)` でロジックを分離する。
→ 方針Aで15行以内に収まる場合は不要。

### ルーティング

`config/routes.rb` の `resources :posts, only: [:create]` を `only: [:create, :show]` に変更する。

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)

- [ ] 正常系: scored状態の投稿の順位計算
- [ ] 正常系: judging/failed状態の投稿の順位はnil
- [ ] 異常系: 存在しない投稿ID
- [ ] 正常系: total_count の計算（scored投稿の総数）
- [ ] 正常系: Post#to_detail_json が正しいJSON構造を返す

### Request Spec (API)

- [ ] `GET /api/posts/:id` - 正常系: scored状態の投稿詳細を取得（審査結果・順位・total_countを含む）
- [ ] `GET /api/posts/:id` - 正常系: judging状態の場合（judgmentsは完了分のみ、rank/average_scoreはnull）
- [ ] `GET /api/posts/:id` - 正常系: failed状態の場合（succeeded=false, error_code含む審査結果が含まれる）
- [ ] `GET /api/posts/:id` - 正常系: 一部の審査員のみ成功した場合（succeeded混在）
- [ ] `GET /api/posts/:id` - 異常系: 存在しない投稿ID (404)
- [ ] `GET /api/posts/:id` - 異常系: 不正なUUID形式 (404)
- [ ] `GET /api/posts/:id` - 異常系: 空文字列のID (404)
- [ ] `GET /api/posts/:id` - レスポンス構造: JSONのキー名・型が仕様通りであること
- [ ] `GET /api/posts/:id` - パフォーマンス: N+1クエリが発生しないこと

### External Service (WebMock/VCR)

- N/A（外部API呼び出しなし）

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** 審査完了した投稿が存在する（status=scored, 3人全員成功）
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス200で投稿詳細、3件の審査結果、順位、total_countが返される

- [ ] **Given** 審査中の投稿が存在する（status=judging、審査完了0件）
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス200で投稿詳細が返される（judgmentsは空配列、rank/average_scoreはnull）

- [ ] **Given** 審査中の投稿が存在する（status=judging、一部審査完了）
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス200で投稿詳細が返される（judgmentsは完了分のみ、rank/average_scoreはnull）

- [ ] **Given** 審査失敗した投稿が存在する（status=failed）
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス200で投稿詳細と失敗した審査結果（succeeded=false, error_code含む）が返される

- [ ] **Given** 一部の審査員のみ成功した投稿が存在する（例: hiroyuki成功, dewi失敗, nakao成功）
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス200で混在した審査結果が返される（各personaのsucceeded/error_codeが正確）

### 異常系 (Error Path)

- [ ] **Given** 存在しない投稿ID
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス404でエラーレスポンス `{ "error": "投稿が見つかりません", "code": "NOT_FOUND" }` が返される

- [ ] **Given** 不正なUUID形式（例: "abc", "123", 特殊文字含む等）
      **When** GET /api/posts/:id をリクエスト
      **Then** ステータス404でエラーレスポンスが返される（500ではなく404で処理）

### 境界値 (Edge Case)

- [ ] **Given** 唯一の投稿（順位1位）
      **When** GET /api/posts/:id をリクエスト
      **Then** rank: 1、total_count: 1が返される

- [ ] **Given** 同点の投稿が複数存在する
      **When** GET /api/posts/:id をリクエスト
      **Then** 正しい順位が返される（created_atの早い方が上位）

- [ ] **Given** average_scoreが0.0の投稿（最低点）
      **When** GET /api/posts/:id をリクエスト
      **Then** rank, average_score: 0.0 が正しく返される

- [ ] **Given** average_scoreが100.0の投稿（満点）
      **When** GET /api/posts/:id をリクエスト
      **Then** rank: 1, average_score: 100.0 が正しく返される

---

## 📁 実装ファイル一覧

### 新規作成

- `backend/spec/requests/api/posts_show_spec.rb`

### 修正

- `backend/app/controllers/api/posts_controller.rb` - show アクション追加、NOT_FOUNDエラーコード定数追加
- `backend/app/models/post.rb` - `to_detail_json` メソッド追加、`total_scored_count` クラスメソッド追加
- `backend/config/routes.rb` - `resources :posts, only: [:create, :show]` に変更

---

## 🔄 TDD実装フロー

### Phase 1: RED（テスト先行）

1. `spec/requests/api/posts_show_spec.rb` を作成
2. テストケースを記述（正常系・異常系・境界値）
3. テストを実行して失敗を確認
   ````bash
   bundle exec rspec spec/requests/api/posts_show_spec.rb
   ````

### Phase 2: GREEN（最小実装）

1. `config/routes.rb` にshowルートを追加
2. `PostsController#show` アクションを実装
3. `Post#to_detail_json` メソッドを実装
4. `Post.total_scored_count` クラスメソッドを実装
5. 以下の処理を実装:
   - Postの取得（RecordNotFound例外のハンドリング）
   - Judgmentの取得（`post.judgments.to_a` でN+1回避）
   - ランキング順位の計算（`post.calculate_rank`）
   - total_countの計算（`Post.total_scored_count`）
   - JSON レスポンスの構築
   - エラーログ出力（投稿ID・エラー内容を含む）
6. テストが通ることを確認
   ````bash
   bundle exec rspec spec/requests/api/posts_show_spec.rb
   ````

### Phase 3: REFACTOR（改善）

1. コードの整理（15行制約の確認）
2. エラーハンドリングの統一（既存の`render_bad_request`パターンに合わせる）
3. RuboCop対応
   ````bash
   bundle exec rubocop -A
   bundle exec brakeman -q
   ````

---

## 🔗 関連資料

- `docs/epics.md` - E07 投稿詳細API
- `backend/app/models/post.rb` - Postモデル
- `backend/app/models/judgment.rb` - Judgmentモデル
- `backend/app/controllers/api/posts_controller.rb` - 既存のcreateアクション

---

## ⚠️ 注意点

### 既存実装の活用

- `Post#calculate_rank` メソッドは既に実装済み
- `Post` と `Judgment` の関連付けは既に定義済み（`has_many :judgments` / `belongs_to :post`）

### DynamoDBの特性

- `Post.find(id)` でRecordNotFound例外が発生する可能性
  - Dynamoidでは `Dynamoid::Errors::RecordNotFound` が発生する
  - 適切にrescueして404レスポンスを返す
- 不正なUUID形式でも例外が発生する可能性がある → 同じく404として処理

### N+1回避

- `judgments` を取得する際は、`post.judgments.to_a` で一括取得
- DynamoDBのため、ActiveRecordの `includes` は使用不可

### total_countの計算パフォーマンス

- `Post.where(status: 'scored').count` はDynamoDBのScanになる可能性がある
- GSI `RankingIndex` を利用してクエリで取得する方が効率的
- 将来的にはキャッシュの導入を検討

### average_scoreの計算ロジック

- `average_score` は **成功した審査員の `total_score` の平均値** とする
- 計算式: `成功審査員のtotal_score合計 / 成功審査員数`
- 失敗した審査員は計算に含めない

### judging状態のjudgments仕様

- `status=judging` の場合、`judgments` 配列には **完了した審査結果のみ** が含まれる
- 審査中の審査員の結果は含まれない（部分的な結果）
- `rank` / `average_score` は `null` とする

### epics.mdとの整合性

- epics.md (L265-L288) のレスポンス形式とプランの形式を統一すること
- epics.md更新時はプランも同時に更新すること

---

## 📝 レビュー指摘事項

### 指摘 1: レスポンス形式の不一致

- **[重要度: 高]**
- **問題点**: プランのレスポンス形式とepics.md (L265-L288) の形式に以下の差異がある:
  1. epics.mdには `total_count` フィールドがあるがプランにはなかった
  2. epics.mdでは `success` を使用しているがDB設計は `succeeded` である
  3. epics.mdではスコアがフラット構造だがプランでは `scores` にネストしていた
  4. epics.mdには `status` / `judges_count` フィールドがない
- **改善提案**: DB設計（`succeeded`）に合わせつつ、フラット構造を採用。`total_count` / `status` / `judges_count` は両方含める。→ **修正済み**

### 指摘 2: routes.rbの変更が実装ファイル一覧に未記載

- **[重要度: 高]**
- **問題点**: `config/routes.rb` の変更（`only: [:create]` → `only: [:create, :show]`）が実装ファイル一覧に含まれていなかった。
- **改善提案**: 修正ファイルに `config/routes.rb` を追加。→ **修正済み**

### 指摘 3: 失敗レスポンスの詳細が不足

- **[重要度: 高]**
- **問題点**: 失敗レスポンスが `{ "error": "...", "code": "..." }` のみで、具体的なエラーコードやHTTPステータスコードが定義されていなかった。
- **改善提案**: 失敗ケース別のHTTPステータス・エラーコード・メッセージを表形式で明記。→ **修正済み**

### 指摘 4: 一部審査員成功ケースの欠落

- **[重要度: 中]**
- **問題点**: 3人中1-2人だけ成功したケース（succeeded混在）のテストケース・受入条件が欠落していた。failed状態だが一部にsucceeded=trueの審査結果がある場合のレスポンス仕様が曖昧。
- **改善提案**: 混在ケースのテストケースと受入条件を追加。→ **修正済み**

### 指摘 5: 同点時の順位計算テストが欠落

- **[重要度: 中]**
- **問題点**: 境界値テストに「同点の場合の順位」が含まれていなかった。score_keyのソート順（created_atが早い方が上位）の検証が不足。
- **改善提案**: 同点ケース、最低点(0.0)、満点(100.0)の境界値テストを追加。→ **修正済み**

### 指摘 6: total_countの計算方法とパフォーマンスが未定義

- **[重要度: 中]**
- **問題点**: `total_count`（全scored投稿数）をどう取得するかが定義されていない。DynamoDBではScanベースのcountは高コスト。
- **改善提案**: GSI `RankingIndex` を利用する方法を明記し、パフォーマンス注意事項を追加。→ **修正済み**

### 指摘 7: コントローラー15行制約への対応方針が不明

- **[重要度: 中]**
- **問題点**: CLAUDE.mdで「1メソッド15行以内」が必須だが、showアクションは投稿取得・Judgment取得・順位計算・total_count計算・JSON構築と処理が多い。方針が不明確だった。
- **改善提案**: 方針A（モデルに`to_detail_json`追加）を採用。実装ファイル一覧に `post.rb` を追加。→ **修正済み**

### 指摘 8: error_codeフィールドの扱いが未定義

- **[重要度: 中]**
- **問題点**: Judgmentモデルには `error_code` フィールド（timeout / provider_error など）があるが、失敗した審査結果のレスポンスに `error_code` を含めるかどうかが定義されていなかった。
- **改善提案**: 失敗した審査結果には `error_code` を含める。スコア関連フィールドは `null` とする。→ **修正済み**

### 指摘 9: Dynamoidの例外クラスの明記

- **[重要度: 低]**
- **問題点**: 「RecordNotFound例外が発生する可能性」と記載があるが、Dynamoidの正確な例外クラス名 `Dynamoid::Errors::RecordNotFound` が不明確だった。
- **改善提案**: 正確な例外クラス名を明記。→ **修正済み**

### 指摘 10: テスト実行コマンドの記載

- **[重要度: 低]**
- **問題点**: TDD実装フローにテスト実行コマンドが記載されていなかった。
- **改善提案**: 各Phaseにコマンドを追加。→ **修正済み**

### 指摘 11: 空文字列IDのテストケースが欠落

- **[重要度: 低]**
- **問題点**: 「不正なUUID形式」はあるが、空文字列（""）やスラッシュのみ（"/"）等のパスパラメータの異常値テストが不足。
- **改善提案**: 空文字列のIDテストケースを追加。→ **修正済み**

### 指摘 12: エラーログ出力の実装方針が不明

- **[重要度: 中]**
- **問題点**: 非機能要件に「ログ出力: エラー発生時にERRORレベルでログ出力（投稿ID・エラー内容を含む）」とあるが、Phase 2の実装手順にログ出力の記述がなかった。
- **改善提案**: Phase 2の実装手順に「エラーログ出力（投稿ID・エラー内容を含む）」を追加。→ **修正済み**

### 指摘 13: Post#to_detail_json メソッドの実装有無が不明

- **[重要度: 中]**
- **問題点**: 方針Aで「`as_json` や `to_detail_json` メソッドをモデルに定義」とあるが、実装ファイル一覧に `post.rb` の修正が含まれていなかった。
- **改善提案**: 実装ファイル一覧の「修正」に `backend/app/models/post.rb` を追加。→ **修正済み**

### 指摘 14: judging状態のjudgmentsレスポンスが未定義

- **[重要度: 中]**
- **問題点**: judging状態のテストケースで「judgmentsは空配列」とあったが、審査中に一部完了している場合の仕様が曖昧だった。
- **改善提案**: 「完了した審査結果のみが含まれる」と明確化。受入条件に「一部審査完了」ケースを追加。→ **修正済み**

### 指摘 15: average_scoreの計算ロジックが未記載

- **[重要度: 中]**
- **問題点**: average_scoreがどのように計算されるか（成功した審査員のみ？全員？）の記載がなかった。
- **改善提案**: 「成功した審査員のtotal_scoreの平均値」と明記。注意点セクションに追加。→ **修正済み**

---

**レビュアーへの確認事項:**

- [x] 仕様の目的が明確か
- [x] レスポンス形式が適切か（epics.mdとの整合性）
- [x] テスト計画は正常系/異常系/境界値を網羅しているか
- [x] 受入条件はGiven-When-Then形式で記述されているか
- [x] 既存機能や他の仕様と矛盾していないか
- [x] `error_code` フィールドをレスポンスに含めるか → **含める（修正済み）**
- [x] `total_count` の取得方法（Scan vs GSI Query）の決定 → **GSI利用（注意点に記載）**
- [x] コントローラー15行制約への対応方針（方針A vs 方針B）の決定 → **方針A採用（修正済み）**
