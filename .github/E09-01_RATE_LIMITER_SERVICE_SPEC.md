---
name: E09-01 RateLimiterService
about: レート制限サービスの実装（TDD準拠）
title: '[SPEC] E09-01 RateLimiterService'
labels: 'spec, e09'
assignees: ''
---

## 📋 概要

投稿のレート制限を実装し、スパム投稿を防止する。IPアドレスとニックネームの両方に対して5分間の投稿制限を設ける。

## 🎯 目的

- スパム投稿の防止
- サーバリソースの保護
- 公平な利用機会の提供

---

## 📝 詳細仕様

### 機能要件

- IPアドレスごとに5分1回の投稿制限
- ニックネームごとに5分1回の投稿制限
- IPアドレスまたはニックネームのいずれかが制限中であれば投稿を拒否する（OR条件）
- 制限中のエラーレスポンス: `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }`
- HTTPステータス: `429 Too Many Requests`
- TTLによる自動削除（5分後）
- 投稿成功時にIPアドレスとニックネームの両方のレート制限を同時に設定する

### 非機能要件

- DynamoDBのTTL機能による自動クリーンアップ
- 高速な制限チェック（最大2回のDBクエリで完結: IP用 + ニックネーム用）
- DynamoDBのTTL削除は最大48時間の遅延があるため、`expires_at`とアプリケーション側の現在時刻を比較して制限状態を判定する
- レート制限チェック時にERRORレベルでのログ出力（制限に抵触した場合のみ、IPハッシュ・ニックネームハッシュを含む）
- DynamoDB操作の例外はrescueし、レート制限チェック失敗時は投稿を許可する（フェイルオープン方式）

### UI/UX設計

API専用のため、N/A

---

## 🔧 技術仕様

### データモデル (DynamoDB)

| 項目 | 値 |
|------|-----|
| Table | `aruaruarena-rate-limits` |
| PK | `identifier` (String: `ip#<SHA256先頭16文字>` または `nick#<SHA256先頭16文字>`) |
| TTL属性 | `expires_at` (Number型: UnixTimestamp整数、現在時刻 + 300秒) |
| GSI | なし |

> **⚠️ 注意: 既存実装との整合性**
> 現在の `RateLimit` モデル (`backend/app/models/rate_limit.rb`) では `expires_at` を `:string` 型で定義しているが、`docs/db_schema.md` では `number` (整数) と定義されている。DynamoDBのTTL機能はNumber型のUnixTimestampを要求するため、**Number型(`:integer`)に統一する**こと。

### API設計

| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | /api/posts |
| Request Body | `{ post: { nickname: "太郎", body: "テスト投稿" } }` |
| Response (成功) | `201 Created` + `{ id: "uuid", status: "judging" }` |
| Response (制限中) | `429 Too Many Requests` + `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }` |

### サービス設計

````ruby
# app/services/rate_limiter_service.rb
class RateLimiterService
  # 定数
  LIMIT_DURATION = 300  # 5分 = 300秒

  # IPアドレスまたはニックネームが制限中かチェック
  # @param ip [String] IPアドレス（生値。内部でハッシュ化する）
  # @param nickname [String] ニックネーム（生値。内部でハッシュ化する）
  # @return [Boolean] trueなら制限中（投稿不可）
  def self.limited?(ip:, nickname:)
    # IPとニックネームの両方をチェック（OR条件）
    # DynamoDB TTL遅延削除対策: expires_at > 現在時刻 をアプリ側で検証
  end

  # 投稿成功後にIPアドレスとニックネームの両方に制限を設定
  # @param ip [String] IPアドレス（生値）
  # @param nickname [String] ニックネーム（生値）
  # @return [void]
  def self.set_limit!(ip:, nickname:)
    # IPとニックネームの2レコードを作成
  end

  private

  # 識別子が制限中かチェック（TTL遅延削除を考慮）
  # @param identifier [String] ハッシュ済み識別子
  # @return [Boolean]
  def self.identifier_limited?(identifier)
    record = RateLimit.find(identifier)
    record.present? && record.expires_at.to_i > Time.now.to_i
  rescue Dynamoid::Errors::RecordNotFound
    false
  end
end
````

> **⚠️ 注意: 既存RateLimitモデルとの関係**
> 既存の `RateLimit` モデルには `limited?` と `set_limit` メソッドが既にあるが、以下の改善が必要:
> 1. `limited?` メソッドは `where` クエリを使っているが、PKで直接 `find` するべき（高速化）
> 2. `limited?` メソッドは `expires_at` と現在時刻の比較を行っていない（TTL遅延削除問題）
> 3. `RateLimiterService` はこれらの改善を含んだラッパーサービスとして機能する
> 4. `clear_limit!` メソッドは、TTLによる自動削除があるため不要。テスト用途のみ（spec_helper等で使用）

### コントローラー統合

````ruby
# app/controllers/api/posts_controller.rb（createアクションに追加）
def create
  # レート制限チェック（投稿バリデーション前に実行）
  if RateLimiterService.limited?(ip: request.remote_ip, nickname: post_params[:nickname])
    return render json: {
      error: "投稿頻度を制限中",
      code: "RATE_LIMITED"
    }, status: :too_many_requests
  end

  post = Post.new(post_params.merge(id: SecureRandom.uuid))

  if post.save
    # 投稿成功後にレート制限を設定
    RateLimiterService.set_limit!(ip: request.remote_ip, nickname: post_params[:nickname])
    start_judgment_async(post)
    render json: { id: post.id, status: post.status }, status: :created
  else
    render_validation_error(post)
  end
rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
  render_bad_request
end
````

> **⚠️ 判断ポイント: レート制限チェックのタイミング**
> - レート制限チェックはバリデーション前に行う（不要なDB操作を避けるため）
> - ただし、`post_params[:nickname]`のパース失敗時は`ParameterMissing`例外が発生するため、パラメータ取得を先に行う必要がある
> - 実装時に `post_params` の呼び出し順序に注意すること

### IPアドレスの取得

| 環境 | 取得方法 |
|------|---------|
| 開発環境 | `request.remote_ip` (通常 `127.0.0.1`) |
| API Gateway + Lambda | `request.headers['X-Forwarded-For']` の最初のIP |
| テスト環境 | RSpecの `headers` で `REMOTE_ADDR` を指定 |

> **⚠️ セキュリティ注意事項**
> - `X-Forwarded-For` はクライアント側で偽装可能。本番環境ではAPI Gatewayが最終段に追加するIPを使用すること
> - IPアドレスは生値をDynamoDBに保存せず、SHA256ハッシュの先頭16文字を使用する（プライバシー保護）
> - ニックネームも同様にハッシュ化して保存する

---

## 🧪 テスト計画 (TDD)

### Unit Test (Service)

- [ ] 正常系: 制限されていない場合、`limited?`がfalseを返す
- [ ] 正常系: `set_limit!`後、`limited?`がtrueを返す
- [ ] 正常系: `set_limit!`でIPとニックネームの2レコードが作成される
- [ ] 正常系: `set_limit!`後、`expires_at`が現在時刻+300秒に設定される
- [ ] 異常系: IP制限中の場合、`limited?`がtrueを返す（ニックネームは未制限でも）
- [ ] 異常系: ニックネーム制限中の場合、`limited?`がtrueを返す（IPは未制限でも）
- [ ] 境界値: `expires_at`が現在時刻と同じ場合、制限解除される（falseを返す）
- [ ] 境界値: `expires_at`が現在時刻+1秒の場合、制限中である（trueを返す）
- [ ] 境界値: TTL期限切れ後（DynamoDBが遅延削除していない場合でも）、expires_atの比較により制限が解除される
- [ ] 異常系: DynamoDB接続エラー時、例外をrescueしてfalseを返す（フェイルオープン）

### Unit Test (Model) ※既存テストの修正

- [ ] `expires_at`の型がNumber(Integer)であることの確認
- [ ] `generate_ip_identifier`が正しいフォーマット (`ip#<hash16>`) を返す（既存テストあり）
- [ ] `generate_nickname_identifier`が正しいフォーマット (`nick#<hash16>`) を返す（既存テストあり）

### Request Spec (API)

- [ ] `POST /api/posts` - 初回投稿は正常に投稿できる（201 Created）
- [ ] `POST /api/posts` - 同一IPで5分以内に2回目の投稿は429エラーを返す
- [ ] `POST /api/posts` - 同一ニックネームで5分以内に2回目の投稿は429エラーを返す
- [ ] `POST /api/posts` - 異なるIPかつ異なるニックネームの場合は連続投稿可能
- [ ] `POST /api/posts` - レート制限エラーの場合、レスポンスボディが `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }` であること
- [ ] `POST /api/posts` - バリデーションエラーとレート制限が同時に発生する場合、レート制限が先に返される
- [ ] `POST /api/posts` - レート制限チェック時のDynamoDBエラーは投稿を阻害しない（フェイルオープン）

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** 初回投稿（IP・ニックネームともに制限なし）
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）

- [ ] **Given** 前回投稿から5分経過後（TTL期限切れ）
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）

- [ ] **Given** 異なるIPアドレスかつ異なるニックネーム
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）

### 異常系 (Error Path)

- [ ] **Given** 同一IPで5分以内に2回目の投稿
      **When** 投稿リクエスト
      **Then** 429 Too Many Requests + `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }`

- [ ] **Given** 同一ニックネームで5分以内に2回目の投稿（IPは異なる）
      **When** 投稿リクエスト
      **Then** 429 Too Many Requests + `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }`

- [ ] **Given** 同一IPかつ同一ニックネームで5分以内に2回目の投稿
      **When** 投稿リクエスト
      **Then** 429 Too Many Requests + `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }`

### 境界値 (Edge Case)

- [ ] **Given** TTL期限直前（4分59秒経過、expires_at > 現在時刻）
      **When** 投稿リクエスト
      **Then** 429 Too Many Requests

- [ ] **Given** TTL期限ちょうど（5分0秒経過、expires_at == 現在時刻）
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）（`expires_at > 現在時刻`ではないため制限解除）

- [ ] **Given** DynamoDBのTTL遅延削除未完了（レコードは存在するがexpires_at < 現在時刻）
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）（アプリ側でexpires_atを比較するため正しく判定）

### フェイルオープン (Resilience)

- [ ] **Given** DynamoDBが一時的に利用不可
      **When** 投稿リクエスト
      **Then** 投稿成功（201 Created）（レート制限チェックをスキップ）

---

## 🔗 関連資料

- [docs/epics.md](docs/epics.md) - E09: レート制限・スパム対策
- [docs/db_schema.md](docs/db_schema.md) - rate_limits テーブル設計
- [backend/app/models/rate_limit.rb](backend/app/models/rate_limit.rb) - 既存モデル（修正対象）
- [backend/spec/models/rate_limit_spec.rb](backend/spec/models/rate_limit_spec.rb) - 既存モデルテスト（修正対象）

---

## 📁 実装ファイル

### 新規作成

| ファイル | 説明 |
|---------|------|
| `app/services/rate_limiter_service.rb` | レート制限サービス |
| `spec/services/rate_limiter_service_spec.rb` | サービステスト |

### 修正

| ファイル | 修正内容 |
|---------|----------|
| `app/models/rate_limit.rb` | `expires_at`を`:integer`型に変更、`limited?`にTTL遅延削除対策を追加 |
| `spec/models/rate_limit_spec.rb` | `expires_at`の型変更に伴うテスト修正 |
| `app/controllers/api/posts_controller.rb` | レート制限チェックの追加（createアクション） |
| `spec/requests/api/posts_spec.rb` | レート制限テストの追加 |

---

## 📝 実装手順

### Phase 1: RED（テスト作成）

1. `spec/services/rate_limiter_service_spec.rb` を作成
   - `limited?` の正常系・異常系・境界値テスト
   - `set_limit!` のレコード作成テスト
   - DynamoDB例外時のフェイルオープンテスト
2. `spec/requests/api/posts_spec.rb` にレート制限テストを追加
   - 429レスポンスのステータスコード・ボディ確認
   - 正常投稿後のレート制限設定確認

### Phase 2: GREEN（実装）

1. `app/models/rate_limit.rb` を修正
   - `expires_at` を `:integer` 型に変更
   - `limited?` にexpires_at比較ロジックを追加
2. `app/services/rate_limiter_service.rb` を作成
   - `limited?` と `set_limit!` の実装
   - DynamoDB例外のrescueとフェイルオープンの実装
3. `app/controllers/api/posts_controller.rb` に統合
   - `createアクション`にレート制限チェックを追加
   - レート制限エラーレスポンスの実装

### Phase 3: REFACTOR（リファクタリング）

1. コードの整理・最適化
2. RuboCop修正
3. 既存モデルテスト (`rate_limit_spec.rb`) の修正・整合性確認

---

## ✅ 検証方法

```bash
# テスト実行
bundle exec rspec spec/services/rate_limiter_service_spec.rb
bundle exec rspec spec/models/rate_limit_spec.rb
bundle exec rspec spec/requests/api/posts_spec.rb

# Lint
bundle exec rubocop -A

# セキュリティスキャン
bundle exec brakeman -q
```

---

## 📝 レビュー指摘事項（反映済み）

### [重要度: 高] `expires_at`の型不一致（String vs Number）
- **問題点**: 既存の `rate_limit.rb` では `expires_at` を `:string` 型で定義しているが、`db_schema.md` では `number` (整数) と定義。DynamoDBのTTL機能はNumber型のUnixTimestampを必要とする。`String` 型のままだとTTLが正しく動作しない可能性がある。
- **改善提案**: `expires_at` を `:integer` 型に修正し、`.to_s` 変換を削除する。`set_limit` メソッドの `(Time.now.to_i + seconds).to_s` を `Time.now.to_i + seconds` に変更。

### [重要度: 高] DynamoDB TTL遅延削除の未考慮
- **問題点**: 既存の `limited?` メソッドはレコードの存在のみで判定しているが、DynamoDBのTTLは即座にレコードを削除しない（最大48時間の遅延がある）。TTL切れ後もレコードが残っている場合、誤って制限中と判定される。
- **改善提案**: `limited?` で `expires_at > Time.now.to_i` のアプリケーション側比較を追加。仕様書にもこの対策を明記済み。

### [重要度: 高] `clear_limit!`メソッドの存在意義
- **問題点**: 元の仕様に `clear_limit!` メソッドがあるが、TTLで自動削除されるため本番用途では不要。テスト用途のみが考えられるが、仕様書に明記されていなかった。
- **改善提案**: `clear_limit!` はサービスのpublicインターフェースから削除。テストでの制限クリアはDynamoDBテーブルのクリーンアップ（`before(:each)` 等）で対応。

### [重要度: 高] レート制限チェックとバリデーションの実行順序
- **問題点**: コントローラーでレート制限チェックとバリデーションのどちらを先に行うかが明記されていなかった。
- **改善提案**: レート制限チェックを先に行う（不要なDB操作を避けるため）。ただし `post_params` の呼び出しが必要なため、パラメータパース→レート制限チェック→バリデーションの順序を明記。

### [重要度: 中] 並行処理時のRace Condition
- **問題点**: 同一IP/ニックネームから極めて短い間隔で同時リクエストが来た場合、`limited?` チェック後 `set_limit!` 前に別のリクエストが入り込む可能性がある（TOCTOU問題）。
- **改善提案**: DynamoDBの `PutItem` with `ConditionExpression` を使って「レコードが存在しない場合のみ作成」にすることで、アトミックな制御が可能。ただし現時点では実装コストが高いため、将来のTODOとして記録。現在のTTL=5分の制約下では許容可能なリスク。

### [重要度: 中] IPアドレス取得方法の環境差異
- **問題点**: 開発環境（`request.remote_ip`）と本番環境（API Gateway + Lambda で `X-Forwarded-For`）でIPアドレスの取得方法が異なる。この差異が仕様に明記されていなかった。
- **改善提案**: IPアドレス取得の環境別仕様を追記。`request.remote_ip` はRailsが `X-Forwarded-For` を自動解析するため、設定次第で両環境で動作する可能性があるが、Lambda環境での動作確認が必要。

### [重要度: 中] フェイルオープンの方針
- **問題点**: DynamoDB障害時のフォールバック方針が未記載だった。レート制限サービスの障害が投稿機能全体を停止させるべきではない。
- **改善提案**: フェイルオープン方式（DynamoDB障害時は制限チェックをスキップして投稿を許可）を仕様に追記。例外をrescueしてログ出力し、falseを返す実装を明記。

### [重要度: 中] OR条件の明確化
- **問題点**: 「IPアドレスごとに5分1回」「ニックネームごとに5分1回」とあるが、「どちらか一方でも制限中であれば拒否」というOR条件が明示的でなかった。
- **改善提案**: 機能要件にOR条件を明記。受入条件にも「同一ニックネーム・異なるIP」のシナリオを追加。

### [重要度: 中] エラーログの出力仕様
- **問題点**: レート制限に抵触した際のログ出力仕様が未定義だった。
- **改善提案**: 非機能要件にログ出力仕様を追記。個人情報保護のため、IPアドレス・ニックネームはハッシュ値をログに出力する。

### [重要度: 低] テスト計画の網羅性
- **問題点**: 「異なるIP・異なるニックネームでの連続投稿が可能」というテストケースが欠如していた。また、DynamoDB接続エラー時のテストケースもなかった。
- **改善提案**: テスト計画にこれらのケースを追加済み。

### [重要度: 低] `limited?`のDBクエリ回数
- **問題点**: 非機能要件に「1回のDBクエリで完結」とあるが、IPとニックネームの2つの識別子を確認するため、実際には最大2回のクエリが必要。
- **改善提案**: 非機能要件を「最大2回のDBクエリで完結」に修正済み。

### [重要度: 低] サービス命名規則
- **問題点**: CLAUDE.mdのサービス命名規則は「動詞 + 名詞 + Service」（例: `CreatePostService`）だが、`RateLimiterService`は「名詞 + Service」に近い。
- **改善提案**: `CheckRateLimitService` のような命名も検討可能だが、`RateLimiterService`はサービスの責務（制限のチェックと設定の両方）を包括的に表現しているため許容範囲。既存の `epics.md` でも `RateLimiterService` と命名されているため、統一性を優先して現名称を維持する。

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
