# E06-05 JudgePostServiceテスト復活プラン

## Context

`backend/spec/services/judge_post_service_spec.rb` に12件のpendingテストがある。これらは `skip 'DewiAdapterとJudgePostServiceの実装後に有効化'` でスキップされているが、**テストの中身が実装されていない**（skip文のみ）。

DewiAdapterとJudgePostServiceは既に実装済み（コミット 77593658, 703a2af1）のため、テストコードを実装して有効化する必要がある。

**現在のステータス**: ブロック中（DynamoDB Localの整合性問題により進行不可）

## Critical Files

| ファイル | 用途 |
|---------|------|
| `backend/spec/services/judge_post_service_spec.rb` | テストコードを実装する対象 |
| `backend/app/services/judge_post_service.rb` | テスト対象のサービスクラス |
| `backend/spec/support/adapter_test_helpers.rb` | モック作成用ヘルパー |
| `backend/spec/rails_helper.rb` | AdapterTestHelpersのインクルード設定 |
| `backend/app/models/judgment.rb` | Judgmentモデル（複合プライマリキー: post_id + persona） |

## テストケース一覧（12件）

### 正常系（3件）

| No. | テストケース | 入力条件 | 期待値 |
|-----|-------------|---------|--------|
| 1 | 3人全員成功時にstatus: scoredになること | 全アダプターが成功レスポンスを返す | `post.status == 'scored'`, `post.judges_count == 3` |
| 2 | 2人成功時にstatus: scoredになること | 2人が成功、1人が失敗 | `post.status == 'scored'`, `post.judges_count == 2` |
| 3 | 平均点が小数第1位に丸められること（四捨五入） | スコア: 50点×2人、75点×1人 | `post.average_score == 58.3`（(50+50+75)/3 = 58.333...） |

### 異常系（3件）

| No. | テストケース | 入力条件 | 期待値 |
|-----|-------------|---------|--------|
| 4 | 全員失敗時にstatus: failedになること | 全アダプターが失敗レスポンスを返す | `post.status == 'failed'`, `post.judges_count == 0` |
| 5 | 1人成功時にstatus: failedになること | 1人だけ成功 | `post.status == 'failed'`, `post.judges_count == 1` |
| 6 | Thread内で例外発生時に失敗として記録されること | 1人で例外発生、2人は成功 | `post.status == 'scored'`, `post.judges_count == 2` |

### 境界値・タイムアウト（2件）

| No. | テストケース | 入力条件 | 期待値 |
|-----|-------------|---------|--------|
| 7 | タイムアウト発生時にerror_code: timeoutになること | 1人が`PER_JUDGE_TIMEOUT`（90秒）を超過 | `judgment.error_code == 'timeout'` |
| 8 | 混合パターンで正しくステータスが決まること | 1人成功、1人APIエラー、1人例外 | `post.status == 'failed'`, `post.judges_count == 1` |

**注意**: タイムアウトテストでは `stub_const('JudgePostService::PER_JUDGE_TIMEOUT', 1)` を使用してテスト時間を短縮する。

### 並列実行（1件）

| No. | テストケース | 入力条件 | 期待値 |
|-----|-------------|---------|--------|
| 9 | 3人の審査員が同時に実行されること | 各アダプターで0.1秒のsleep | 全アダプターの開始時刻差が0.2秒以内 |

**判定根拠**: 3つのスレッドが並列実行される場合、0.1秒のsleepを含む処理が0.2秒以内に開始されれば並列実行と判断可能。

### Judgment保存（2件）

| No. | テストケース | 入力条件 | 期待値 |
|-----|-------------|---------|--------|
| 10 | 成功した審査結果がJudgmentテーブルに保存されること | 2人成功、1人失敗 | `successful_judgments.size == 2`, personaが `['hiroyuki', 'dewi']` |
| 11 | 失敗した審査結果もJudgmentテーブルに保存されること | 1人成功、2人失敗 | `failed_judgments.size == 2` |

### ステータス更新（2件）

| No. | テストケース | 入力条件 | 期待値 |
|-----|-------------|---------|--------|
| 12 | 2人以上成功時にstatus: scoredになりaverage_scoreが設定されること | 2人成功 | `post.status == 'scored'`, `post.average_score` が存在 |
| 13 | 1人成功時にstatus: failedになりaverage_scoreがnilであること | 1人成功 | `post.status == 'failed'`, `post.average_score.nil?` |

**注意**: No.12とNo.13はNo.1-5と重複するが、`#update_post_status!`のprivateメソッド単体テストとして独立して記述。

## 実装済みの変更

### 1. rails_helper.rbにAdapterTestHelpersのインクルード設定を追加

```ruby
config.include AdapterTestHelpers, type: :model
config.include AdapterTestHelpers, type: :service
```

### 2. テストコードを実装（12件）

テストファイルに上記12件のテストを実装済み。

### 3. FactoryBotを使用するように変更

```ruby
let!(:post) { create(:post) }
```

### 4. 各テスト前のクリーンアップ処理

```ruby
before(:each) do
  Judgment.delete_all
  sleep(0.5) # DynamoDB Localの非同期削除完了待ち
end
```

## 残っている問題

### DynamoDB Localの整合性の問題

テスト実行時に以下のエラーが発生：

```
Dynamoid::Errors::RecordNotUnique:
  Attempted to write record #<Judgment:...> when its key already exists
```

**原因**: DynamoDB Localの読み取り/書き込みの整合性の問題。`delete_all`が非同期で実行されるため、前のテストのデータが残っている可能性がある。

**調査結果**:
- テスト開始時に `Judgment.all.to_a` は空（`[]`）
- `Judgment.find(post_id, persona)` は `RecordNotFound` を返す
- それでも `judgment.save!` で `RecordNotUnique` エラーが発生
- 特に `dewi` ペルソナで一貫してエラーが発生

**技術的背景**:
- Dynamoidの `find` メソッドはデフォルトで「結果的に整合性のある読み取り」を使用
- `save!` の条件付き書き込みは「強力な整合性のある読み取り」を使用
- この差により、`find` で見つからないレコードが `save!` では存在していると判定される可能性

## 推奨される解決策（優先度順）

### 1. 強力な整合性のある読み取りを使用（推奨）

`save_judgments!` メソッド内の `find` で `consistent_read: true` を使用：

```ruby
# 現在のコード
judgment = Judgment.find(@post.id, persona) rescue nil

# 修正案
judgment = Judgment.find(@post.id, persona, consistent_read: true) rescue nil
```

### 2. upsertパターンを実装

`find` + `save!` ではなく、条件付き更新を使用：

```ruby
# Dynamoidでは find_or_initialize_by が非推奨のため、where を使用
def save_judgments!(results)
  @successful_judgments = []

  results.each do |data|
    next unless data

    persona = data[:persona]
    result = data[:result]

    # where で検索して first を取得
    judgment = Judgment.where(post_id: @post.id, persona: persona).first
    judgment ||= Judgment.new(post_id: @post.id, persona: persona)

    # 属性を設定して保存
    judgment.assign_attributes(...)
    judgment.save!

    @successful_judgments << judgment if result.succeeded
  end
end
```

### 3. テスト間の待機時間を増やす

```ruby
before(:each) do
  Judgment.delete_all
  sleep(1.0) # 待機時間を増やす
end
```

### 4. DynamoDB Localの設定を確認

- `Dynamoid.configure` で `consistent_read` オプションを確認
- Docker Compose等でDynamoDB Localを再起動

## セキュリティ考慮事項

- 本テストはモックを使用するため、実際のAPIキーや機密情報は扱わない
- テスト用のダミーデータのみを使用

## 非機能要件

### エラーハンドリング

以下のエラーケースをテストでカバー：
- APIタイムアウト（`timeout` エラーコード）
- スレッド内例外（`thread_exception` エラーコード）
- APIプロバイダーエラー（`provider_error` エラーコード）

### ログ出力

現在のテストでは検証しない。理由：
- モック環境では実際のログ出力は重要ではない
- 必要に応じて別途統合テストで検証

## 次のステップ

1. **解決策1（強力な整合性のある読み取り）を実装** - 最も影響範囲が小さい
2. テストがパスするか確認
3. パスしない場合は解決策2（upsertパターン）を実装
4. テストがパスしたらRubocopを実行
5. コミットを作成

## Verification

```bash
# テスト実行
cd backend && bundle exec rspec spec/services/judge_post_service_spec.rb --format documentation

# 全テスト実行
cd backend && bundle exec rspec

# Lint
cd backend && bundle exec rubocop -A

# セキュリティスキャン
cd backend && bundle exec brakeman -q
```

## Summary

| カテゴリ | テスト件数 | 状態 |
|---------|----------|------|
| 正常系 | 3 | 実装済み（DynamoDB問題で失敗） |
| 異常系 | 3 | 実装済み（DynamoDB問題で失敗） |
| 境界値・タイムアウト | 2 | 実装済み（DynamoDB問題で失敗） |
| 並列実行 | 1 | 実装済み（DynamoDB問題で失敗） |
| Judgment保存 | 2 | 実装済み（DynamoDB問題で失敗） |
| ステータス更新 | 2 | 実装済み（DynamoDB問題で失敗） |
| **合計** | **13** | **実装済み** |

**現在の状況**: テストコードは実装完了しているが、DynamoDB Localの整合性の問題によりテストが失敗している。解決策1（強力な整合性のある読み取り）を優先的に実装する。
