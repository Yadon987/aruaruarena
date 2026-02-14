---
name: E09-02 DuplicateCheckService
about: 重複チェックサービスの実装（TDD準拠）
title: '[SPEC] E09-02 DuplicateCheckService'
labels: 'spec, e09'
assignees: ''
---

## 📋 概要

同一テキストの24時間以内の重複投稿を防止する。正規化処理により、空白や全角・半角の違いを吸収してチェックする。

## 🎯 目的

- コピペ投稿の防止
- 完全同一だけでなく、実質的に同じ内容の投稿もブロック
- データベースの品質維持

---

## 📝 詳細仕様

### 機能要件

- 同一テキストは24時間以内に投稿不可
- 正規化処理による実質同一の検出：
  - 全角→半角変換（NFKC正規化）
  - カタカナ→ひらがな変換
  - 空白の統一（連続空白を1つに）
  - 前後空白の削除
  - 小文字化
- 制限中のエラーレスポンス: `{ error: "同じ内容の投稿があります", code: "DUPLICATE_CONTENT" }`
- HTTPステータス: `422 Unprocessable Entity`
- TTLによる自動削除（24時間後）
- 投稿成功時に重複チェックレコードを登録する

### 非機能要件

- DynamoDBのTTL機能による自動クリーンアップ
- SHA256ハッシュによる高速な重複チェック（1回のDBクエリで完結: PKで直接検索）
- DynamoDBのTTL削除は最大48時間の遅延があるため、`expires_at`とアプリケーション側の現在時刻を比較して重複状態を判定する
- 重複チェック時にWARNレベルでのログ出力（重複に抵触した場合のみ、body_hashを含む）
- DynamoDB操作の例外はrescueし、重複チェック失敗時は投稿を許可する（フェイルオープン方式）
  - E09-01 RateLimiterServiceと同一のフェイルオープンポリシーに準拠

### UI/UX設計

API専用のため、N/A

---

## 🔧 技術仕様

### データモデル (DynamoDB)

| 項目 | 値 |
|------|-----|
| Table | `aruaruarena-duplicate-checks` |
| PK | `body_hash` (String: SHA256ハッシュ) |
| Attributes | `post_id` (String), `expires_at` (Number: UnixTimestamp整数) |
| TTL | `expires_at` (Number型: UnixTimestamp整数、現在時刻 + 86400秒) |
| GSI | なし |

> **⚠️ 注意: 既存実装との整合性**
> 現在の `DuplicateCheck` モデル (`backend/app/models/duplicate_check.rb`) では `expires_at` を `:string` 型で定義しているが、`docs/db_schema.md` では `number` (整数) と定義されている。DynamoDBのTTL機能はNumber型のUnixTimestampを要求するため、**Number型(`:integer`)に統一する**こと。
> これはE09-01 RateLimiterServiceの `rate_limit.rb` と同様の修正である。

### 正規化処理

````ruby
# 正規化処理の詳細
normalized = body
             .unicode_normalize(:nfkc)  # 全角→半角（NFKCによる互換分解＋正規合成）
             .tr('ァ-ン', 'ぁ-ん')       # カタカナ→ひらがな
             .gsub(/\s+/, ' ')          # 空白統一（タブ・改行含む全空白文字を半角スペース1つに）
             .strip.downcase            # 前後空白削除 + 小文字化

Digest::SHA256.hexdigest(normalized)
````

> **⚠️ 注意: 正規化処理の既存実装**
> 上記の正規化処理は既に `DuplicateCheck.generate_body_hash` メソッドとして実装済み（`backend/app/models/duplicate_check.rb`）。`DuplicateCheckService` はこのメソッドを内部的に呼び出すラッパーサービスとして機能する。

### API設計

| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | /api/posts |
| Request Body | `{ post: { nickname: "太郎", body: "テスト投稿" } }` |
| Response (成功) | `201 Created` + `{ id: "uuid", status: "judging" }` |
| Response (重複) | `422 Unprocessable Entity` + `{ error: "同じ内容の投稿があります", code: "DUPLICATE_CONTENT" }` |

### サービス設計

````ruby
# app/services/duplicate_check_service.rb
class DuplicateCheckService
  # 定数
  DUPLICATE_DURATION_HOURS = 24  # 24時間
  DUPLICATE_DURATION_SECONDS = DUPLICATE_DURATION_HOURS * 3600  # 86400秒

  # 同一テキストが24時間以内に投稿されているかチェック
  # @param body [String] 投稿本文（生値。内部で正規化 + ハッシュ化する）
  # @return [Boolean] trueなら重複あり（投稿不可）
  def self.duplicate?(body:)
    hash = DuplicateCheck.generate_body_hash(body)
    record = DuplicateCheck.find(hash)
    record.present? && record.expires_at.to_i > Time.now.to_i
  rescue Dynamoid::Errors::RecordNotFound
    false
  rescue StandardError => e
    # フェイルオープン: DB障害時は重複チェックをスキップして投稿を許可
    Rails.logger.error("[DuplicateCheckService] duplicate? failed: #{e.class} - #{e.message}")
    false
  end

  # 投稿成功後に重複チェックレコードを登録
  # @param body [String] 投稿本文（生値）
  # @param post_id [String] 投稿ID
  # @return [DuplicateCheck] 作成されたレコード
  def self.register!(body:, post_id:)
    hash = DuplicateCheck.generate_body_hash(body)
    DuplicateCheck.create!(
      body_hash: hash,
      post_id: post_id,
      expires_at: Time.now.to_i + DUPLICATE_DURATION_SECONDS
    )
  rescue StandardError => e
    # 登録失敗時はログ出力のみ（投稿自体は成功させる）
    Rails.logger.error("[DuplicateCheckService] register! failed: #{e.class} - #{e.message}")
    nil
  end
end
````

> **⚠️ 注意: 既存DuplicateCheckモデルとの関係**
> 既存の `DuplicateCheck` モデルには `check` と `register` メソッドが既にあるが、以下の改善が必要:
> 1. `check` メソッドは `where` クエリを使っているが、PKで直接 `find` するべき（高速化）
> 2. `check` メソッドは `expires_at` と現在時刻の比較を行っていない（TTL遅延削除問題）
> 3. `register` メソッドは `expires_at` を文字列型で保存しているが、Number型（整数）に変更が必要
> 4. `DuplicateCheckService` はこれらの改善を含んだラッパーサービスとして機能する
> 5. 元の `clear!` メソッドは仕様から削除。TTLによる自動削除があるため不要。テスト用途のみ（spec_helper等のクリーンアップで対応）

### コントローラー統合

````ruby
# app/controllers/api/posts_controller.rb（createアクションに追加）
def create
  # 1. レート制限チェック（E09-01で実装済みの場合）
  # if RateLimiterService.limited?(ip: request.remote_ip, nickname: post_params[:nickname])
  #   return render json: { error: "投稿頻度を制限中", code: "RATE_LIMITED" }, status: :too_many_requests
  # end

  # 2. 重複チェック（レート制限チェックの後、バリデーションの前に実行）
  if DuplicateCheckService.duplicate?(body: post_params[:body])
    return render json: {
      error: "同じ内容の投稿があります",
      code: "DUPLICATE_CONTENT"
    }, status: :unprocessable_entity
  end

  post = Post.new(post_params.merge(id: SecureRandom.uuid))

  if post.save
    # 投稿成功後に重複チェックレコードを登録
    DuplicateCheckService.register!(body: post_params[:body], post_id: post.id)
    start_judgment_async(post)
    render json: { id: post.id, status: post.status }, status: :created
  else
    render_validation_error(post)
  end
rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
  render_bad_request
end
````

> **⚠️ 判断ポイント: チェックの実行順序**
> - E09-01のレート制限チェック → E09-02の重複チェック → バリデーション の順序で実行する
> - レート制限の方がDBクエリコストが低い（PK検索のみ）ため、先にチェックする
> - ただし、`post_params[:body]`のパース失敗時は`ParameterMissing`例外が発生するため、パラメータ取得を先に行う必要がある
> - 重複チェックとレート制限の両方に抵触する場合は、レート制限エラーが先に返される

> **⚠️ 判断ポイント: register! の失敗時の挙動**
> - `register!` が失敗しても投稿自体は成功させる（フェイルオープン）
> - これにより、一時的にDynamoDBに障害があっても投稿機能は停止しない
> - ただし、`register!` が失敗した場合、次回の同一テキスト投稿が重複として検出されない可能性がある

---

## 🧪 テスト計画 (TDD)

### Unit Test (Service)

- [ ] 正常系: 重複していない場合、`duplicate?`がfalseを返す
- [ ] 正常系: `register!`後、`duplicate?`がtrueを返す
- [ ] 正常系: `register!`後、body_hashが正しく設定される
- [ ] 正常系: `register!`後、`expires_at`が現在時刻+86400秒（整数）に設定される
- [ ] 異常系: 完全同一テキストの場合、`duplicate?`がtrueを返す
- [ ] 異常系: 正規化後に同一になるテキストの場合、`duplicate?`がtrueを返す
- [ ] 境界値: 24時間経過後（`expires_at` < 現在時刻）、`duplicate?`がfalseを返す
- [ ] 境界値: `expires_at`が現在時刻と同じ場合、重複チェックが解除される（falseを返す）
- [ ] 境界値: `expires_at`が現在時刻+1秒の場合、重複中である（trueを返す）
- [ ] 境界値: TTL期限切れ後（DynamoDBが遅延削除していない場合でも）、expires_atの比較により重複チェックが解除される
- [ ] 異常系: DynamoDB接続エラー時、`duplicate?`は例外をrescueしてfalseを返す（フェイルオープン）
- [ ] 異常系: DynamoDB接続エラー時、`register!`は例外をrescueしてnilを返す（フェイルオープン）
- [ ] 異常系: 異なるテキストの場合、`duplicate?`がfalseを返す

### Unit Test (Model) ※既存テストの修正

- [ ] `expires_at`の型がNumber(Integer)であることの確認
- [ ] `generate_body_hash`が正しいSHA256ハッシュを返す（既存テストあり）
- [ ] `register` メソッドの `expires_at` が整数型で保存されることの確認

### Request Spec (API)

- [ ] `POST /api/posts` - 重複時は422エラーを返す
- [ ] `POST /api/posts` - 重複していない場合は正常に投稿できる（201 Created）
- [ ] `POST /api/posts` - 正規化後に同一になるテキストの場合は422エラーを返す
- [ ] `POST /api/posts` - 重複エラーの場合、レスポンスボディが `{ error: "同じ内容の投稿があります", code: "DUPLICATE_CONTENT" }` であること
- [ ] `POST /api/posts` - 24時間経過後は同一テキストでも投稿可能
- [ ] `POST /api/posts` - 異なるテキストは連続投稿可能
- [ ] `POST /api/posts` - 重複チェック時のDynamoDBエラーは投稿を阻害しない（フェイルオープン）
- [ ] `POST /api/posts` - バリデーションエラーと重複が同時に発生する場合、重複チェックが先に返される

### 正規化テスト

- [ ] 全角→半角変換: "ＡＢＣ" == "ABC"
- [ ] カタカナ→ひらがな: "アいう" == "あいう"
- [ ] 空白統一: "a  b" == "a b"
- [ ] 小文字化: "ABC" == "abc"
- [ ] タブ・改行の統一: "a\tb" == "a b", "a\nb" == "a b"
- [ ] 前後空白の削除: " abc " == "abc"
- [ ] 複合正規化: "　Ｔｅｓｔ　　トウコウ　" == "test とうこう"

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** 初回投稿（同一テキストの重複レコードが存在しない）
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）

- [ ] **Given** 24時間経過後（TTL期限切れ）
      **When** 同一テキストで投稿リクエスト
      **Then** 投稿成功（201 Created）

- [ ] **Given** 異なるテキストの投稿
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）

### 異常系 (Error Path)

- [ ] **Given** 同一テキストが24時間以内に存在
      **When** 投稿リクエスト
      **Then** 422 Unprocessable Entity + `{ error: "同じ内容の投稿があります", code: "DUPLICATE_CONTENT" }`

- [ ] **Given** 正規化後に同一になるテキストが24時間以内に存在
      **When** 投稿リクエスト
      **Then** 422 Unprocessable Entity + `{ error: "同じ内容の投稿があります", code: "DUPLICATE_CONTENT" }`

### 境界値 (Edge Case)

- [ ] **Given** 24時間経過直前（23時間59分、`expires_at` > 現在時刻）
      **When** 同一テキストで投稿リクエスト
      **Then** 422 Unprocessable Entity

- [ ] **Given** 24時間ちょうど経過（`expires_at` == 現在時刻）
      **When** 同一テキストで投稿リクエスト
      **Then** 投稿成功（201 Created）（`expires_at > 現在時刻`ではないため重複チェック解除）

- [ ] **Given** DynamoDBのTTL遅延削除未完了（レコードは存在するが`expires_at` < 現在時刻）
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）（アプリ側で`expires_at`を比較するため正しく判定）

### フェイルオープン (Resilience)

- [ ] **Given** DynamoDBが一時的に利用不可
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）（重複チェックをスキップ）

- [ ] **Given** DynamoDBが一時的に利用不可
      **When** 投稿リクエスト成功後のregister!
      **Then** 投稿自体は成功（register!の失敗はログ出力のみ）

---

## 🔗 関連資料

- [docs/epics.md](docs/epics.md) - E09: レート制限・スパム対策
- [docs/db_schema.md](docs/db_schema.md) - duplicate_checks テーブル設計
- [backend/app/models/duplicate_check.rb](backend/app/models/duplicate_check.rb) - 既存モデル（修正対象）
- [backend/spec/models/duplicate_check_spec.rb](backend/spec/models/duplicate_check_spec.rb) - 既存モデルテスト（修正対象）
- [.github/E09-01_RATE_LIMITER_SERVICE_SPEC.md](.github/E09-01_RATE_LIMITER_SERVICE_SPEC.md) - E09-01 RateLimiterService仕様書（同一パターンの設計）

---

## 📁 実装ファイル

### 新規作成

| ファイル | 説明 |
|---------|------|
| `app/services/duplicate_check_service.rb` | 重複チェックサービス |
| `spec/services/duplicate_check_service_spec.rb` | サービステスト |

### 修正

| ファイル | 修正内容 |
|---------|----------|
| `app/models/duplicate_check.rb` | `expires_at`を`:integer`型に変更、`check`メソッドにTTL遅延削除対策を追加、`register`メソッドの`.to_s`を削除 |
| `spec/models/duplicate_check_spec.rb` | `expires_at`の型変更に伴うテスト修正（`.to_i`変換の削除） |
| `app/controllers/api/posts_controller.rb` | 重複チェックの追加（createアクション） |
| `spec/requests/api/posts_spec.rb` | 重複チェックテストの追加 |

---

## 📝 実装手順

### Phase 1: RED（テスト作成）

1. `spec/services/duplicate_check_service_spec.rb` を作成
   - `duplicate?` の正常系・異常系・境界値テスト
   - `register!` のレコード作成テスト
   - DynamoDB例外時のフェイルオープンテスト
2. `spec/requests/api/posts_spec.rb` に重複チェックテストを追加
   - 422レスポンスのステータスコード・ボディ確認
   - 正常投稿後の重複チェックレコード登録確認

### Phase 2: GREEN（実装）

1. `app/models/duplicate_check.rb` を修正
   - `expires_at` を `:integer` 型に変更
   - `check` メソッドに`expires_at`比較ロジックを追加
   - `register` メソッドの `.to_s` を削除
2. `app/services/duplicate_check_service.rb` を作成
   - `duplicate?` と `register!` の実装
   - DynamoDB例外のrescueとフェイルオープンの実装
3. `app/controllers/api/posts_controller.rb` に統合
   - `createアクション`に重複チェックを追加（レート制限チェックの後、バリデーションの前）
   - 重複エラーレスポンスの実装

### Phase 3: REFACTOR（リファクタリング）

1. コードの整理・最適化
2. RuboCop修正
3. 既存モデルテスト (`duplicate_check_spec.rb`) の修正・整合性確認

---

## ✅ 検証方法

```bash
# テスト実行
bundle exec rspec spec/services/duplicate_check_service_spec.rb
bundle exec rspec spec/models/duplicate_check_spec.rb
bundle exec rspec spec/requests/api/posts_spec.rb

# Lint
bundle exec rubocop -A

# セキュリティスキャン
bundle exec brakeman -q
```

---

## 📝 レビュー指摘事項（反映済み）

### [重要度: 高] `expires_at`の型不一致（String vs Number）
- **問題点**: 既存の `duplicate_check.rb` では `expires_at` を `:string` 型で定義しているが、`db_schema.md` では `number` (整数) と定義。DynamoDBのTTL機能はNumber型のUnixTimestampを必要とする。`String` 型のままだとTTLが正しく動作しない可能性がある。これはE09-01の `rate_limit.rb` と同様の問題。
- **改善提案**: `expires_at` を `:integer` 型に修正し、`register` メソッドの `.to_s` 変換を削除する。`(Time.now.to_i + (hours * 3600)).to_s` を `Time.now.to_i + (hours * 3600)` に変更。

### [重要度: 高] DynamoDB TTL遅延削除の未考慮
- **問題点**: 既存の `check` メソッドはレコードの存在のみで判定しているが、DynamoDBのTTLは即座にレコードを削除しない（最大48時間の遅延がある）。TTL切れ後もレコードが残っている場合、誤って重複と判定される。
- **改善提案**: `duplicate?` で `expires_at > Time.now.to_i` のアプリケーション側比較を追加。E09-01 RateLimiterServiceと同様の対策。

### [重要度: 高] フェイルオープンの方針未記載
- **問題点**: DynamoDB障害時のフォールバック方針が未記載だった。重複チェックサービスの障害が投稿機能全体を停止させるべきではない。
- **改善提案**: フェイルオープン方式（DynamoDB障害時は重複チェックをスキップして投稿を許可）を仕様に追記。`duplicate?`と`register!`の両方で例外をrescueしてログ出力し、それぞれfalse/nilを返す実装を明記。

### [重要度: 高] サービス設計の詳細不足
- **問題点**: 元の仕様書では `DuplicateCheckService` のメソッドシグネチャのみ記載され、実装の詳細（例外処理、ログ出力、フェイルオープン）が欠如していた。
- **改善提案**: E09-01 RateLimiterServiceと同様のレベルでサービス設計の詳細（擬似コード含む）を追記。

### [重要度: 高] コントローラー統合の実装詳細不足
- **問題点**: コントローラーへの統合方法が明記されていなかった。E09-01のレート制限チェックとE09-02の重複チェックの実行順序も不明確。
- **改善提案**: コントローラー統合のコード例を追記。レート制限チェック→重複チェック→バリデーションの実行順序を明記。

### [重要度: 高] `clear!`メソッドの存在意義
- **問題点**: 元の仕様に `clear!` メソッドがあるが、TTLで自動削除されるため本番用途では不要。テスト用途のみが考えられるが、仕様書に明記されていなかった。
- **改善提案**: `clear!` はサービスのpublicインターフェースから削除。テストでの重複クリアはDynamoDBテーブルのクリーンアップ（`before(:each)` 等）で対応。

### [重要度: 中] 既存モデルの`check`メソッドのクエリ効率
- **問題点**: 既存の `DuplicateCheck.check` メソッドは `where(body_hash: hash).first` を使用しているが、`body_hash` はPKであるため、`find` による直接アクセスの方が効率的。
- **改善提案**: DuplicateCheckServiceでは `find` を使用し、`RecordNotFound` を rescue する設計に変更。

### [重要度: 中] 並行処理時のRace Condition
- **問題点**: 極めて短い間隔で同一テキストの投稿が同時に行われた場合、`duplicate?` チェック後 `register!` 前に別のリクエストが入り込む可能性がある（TOCTOU問題）。
- **改善提案**: DynamoDBの `PutItem` with `ConditionExpression` を使って「レコードが存在しない場合のみ作成」にすることで、アトミックな制御が可能。ただし現時点では実装コストが高いため、将来のTODOとして記録。24時間TTLの制約下では許容可能なリスク。

### [重要度: 中] テスト計画の網羅性不足
- **問題点**: 以下のテストケースが欠如していた:
  - 「異なるテキストは連続投稿可能」のテスト
  - DynamoDB接続エラー時のテスト（`duplicate?`と`register!`の両方）
  - `expires_at`境界値の詳細テスト（`== 現在時刻`、`> 現在時刻`）
  - タブ・改行の正規化テスト
  - 複合正規化テスト
  - `register!` 失敗時のフェイルオープンテスト
  - バリデーションエラーと重複チェックの優先順位テスト
- **改善提案**: テスト計画にこれらのケースを追加済み。

### [重要度: 中] 非機能要件のログレベル未定義
- **問題点**: 重複チェックに抵触した際のログ出力仕様が未定義だった。
- **改善提案**: 非機能要件にログ出力仕様を追記。重複抵触時はWARNレベル、DynamoDBエラー時はERRORレベルでログ出力。E09-01と同様のログポリシー。

### [重要度: 中] E09-01との一貫性不足
- **問題点**: E09-01 RateLimiterServiceの仕様書と比較して、以下の観点が欠如していた: フェイルオープン方針、TTL遅延削除対策、コントローラー統合の実装順序、テストの網羅性。
- **改善提案**: E09-01と同等のレベルに引き上げて記述を追加。

### [重要度: 低] 受入条件にフェイルオープンシナリオが欠如
- **問題点**: DynamoDB障害時のフェイルオープン動作が受入条件に含まれていなかった。
- **改善提案**: 「フェイルオープン (Resilience)」セクションを受入条件に追加。`duplicate?`の失敗時と`register!`の失敗時の2パターンを記載。

### [重要度: 低] サービス命名規則
- **問題点**: CLAUDE.mdのサービス命名規則は「動詞 + 名詞 + Service」（例: `CreatePostService`）だが、`DuplicateCheckService`は「名詞 + Service」に近い。
- **改善提案**: `CheckDuplicateService` のような命名も検討可能だが、`DuplicateCheckService`はサービスの責務（重複のチェックと登録の両方）を包括的に表現しているため許容範囲。既存の `epics.md` でも `DuplicateCheckService` と命名されているため、統一性を優先して現名称を維持する。

### [重要度: 低] 関連資料にE09-01仕様書がリンクされていない
- **問題点**: 同一Epicの関連仕様であるE09-01 RateLimiterService仕様書が関連資料に含まれていなかった。
- **改善提案**: 関連資料にE09-01仕様書のリンクを追加。

---

**レビュアーへの確認事項:**
- [ ] 仕様の目的が明確か
- [ ] DynamoDBのキー設計はアクセスパターンに適しているか
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 既存機能や他の仕様と矛盾していないか
- [ ] `expires_at`の型修正（String → Integer）の影響範囲を確認したか
- [ ] フェイルオープン方式が本プロジェクトのセキュリティ要件に適合するか
- [ ] TTL遅延削除対策（アプリ側での`expires_at`比較）が妥当か
- [ ] E09-01 RateLimiterServiceとの一貫性が保たれているか
