# E07 投稿詳細API REDテストプラン

## 概要

E07「投稿詳細API」実装のためのTDD用REDテストコード作成プラン。
E07_POST_DETAIL_API_PLAN.mdに基づき、GET /api/posts/:id エンドポイントの受入条件を網羅するテストを書く。

**目的**: テスト駆動開発（TDD）のRED段階として、実装前に失敗するテストを作成する。

---

## 作成するファイル

```
backend/spec/requests/api/posts_show_spec.rb
```

---

## テストケース一覧（計12件）

### 正常系（5件）

| No | テスト名 | 検証内容 |
|----|---------|---------|
| 1 | 審査完了した投稿（status=scored, 3人全員成功）の詳細取得 | HTTP 200, 全フィールド、judgments配列(3件)、rank/total_count |
| 2 | 審査中の投稿（status=judging, 審査完了0件）の詳細取得 | HTTP 200, judgments: [], rank: nil, average_score: nil |
| 3 | 審査中の投稿（status=judging, 一部審査完了）の詳細取得 | HTTP 200, 完了分のみjudgments、rank: nil, average_score: nil |
| 4 | 審査失敗した投稿（status=failed）の詳細取得 | HTTP 200, succeeded=false, error_code含む |
| 5 | 一部の審査員のみ成功した投稿（succeeded混在）の詳細取得 | HTTP 200, succeeded混在、失敗分はerror_codeあり |

### 異常系（3件）

| No | テスト名 | 検証内容 |
|----|---------|---------|
| 1 | 存在しない投稿ID | HTTP 404, code: "NOT_FOUND" |
| 2 | 不正なUUID形式 | HTTP 404, code: "NOT_FOUND" |
| 3 | 空文字列のID | HTTP 404, code: "NOT_FOUND" |

### 境界値（4件）

| No | テスト名 | 検証内容 |
|----|---------|---------|
| 1 | 唯一の投稿（順位1位） | rank: 1, total_count: 1 |
| 2 | 同点の投稿が複数存在 | created_atの早い方が上位 |
| 3 | average_scoreが0.0の投稿 | 最低点の処理 |
| 4 | average_scoreが100.0の投稿 | 満点の処理、rank: 1 |

---

## テストファイル構成

```ruby
# backend/spec/requests/api/posts_show_spec.rb
RSpec.describe 'GET /api/posts/:id', type: :request do
  before do
    Post.delete_all
    Judgment.delete_all
  end

  describe '正常系' do
    # 5件のテスト
  end

  describe '異常系' do
    # 3件のテスト
  end

  describe '境界値' do
    # 4件のテスト
  end
end
```

---

## 実装パターン（既存コード準拠）

### FactoryBot使用

```ruby
# Post作成
post = create(:post, :scored, nickname: '太郎', body: 'あるある')
post = create(:post, :failed, judges_count: 1)

# Judgment作成
create(:judgment, :hiroyuki, post_id: post.id, total_score: 85)
create(:judgment, :dewi, post_id: post.id, :failed, error_code: 'timeout')
```

### レスポンス検証

```ruby
get "/api/posts/#{post.id}"
expect(response).to have_http_status(:ok)
json = response.parsed_body

# フィールド検証
expect(json['id']).to eq(post.id)
expect(json['code']).to eq('NOT_FOUND')
```

---

## 禁止事項（CLAUDE.md準拠）

- `.permit!` を使用しない
- N+1クエリを発生させない
- `binding.pry` を残さない
- コメント・コミットメッセージは日本語

---

## 各テストの実装詳細

### テスト1: 審査完了した投稿の詳細取得

```ruby
# 検証: status=scoredの投稿が3人全員成功した審査結果と共に返る
it '審査完了した投稿（status=scored, 3人全員成功）の詳細を取得できる' do
  post = create(:post, :scored, nickname: '太郎', body: 'スヌーズ押して二度寝', average_score: 85.3, judges_count: 3)
  create(:judgment, :hiroyuki, post_id: post.id, total_score: 85)
  create(:judgment, :dewi, post_id: post.id, total_score: 88)
  create(:judgment, :nakao, post_id: post.id, total_score: 83)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['id']).to eq(post.id)
  expect(json['nickname']).to eq('太郎')
  expect(json['body']).to eq('スヌーズ押して二度寝')
  expect(json['average_score']).to eq(85.3)
  expect(json['status']).to eq('scored')
  expect(json['judges_count']).to eq(3)
  expect(json['rank']).to eq(1)
  expect(json['total_count']).to eq(1)
  expect(json['judgments'].length).to eq(3)
end
```

### テスト2: 審査中の投稿（審査完了0件）

```ruby
# 検証: status=judgingで審査結果が0件の場合、judgmentsは空配列
it '審査中の投稿（status=judging, 審査完了0件）の詳細を取得できる' do
  post = create(:post, status: 'judging', judges_count: 0)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['status']).to eq('judging')
  expect(json['judges_count']).to eq(0)
  expect(json['judgments']).to eq([])
  expect(json['rank']).to be_nil
  expect(json['average_score']).to be_nil
end
```

### テスト3: 審査中の投稿（一部審査完了）

```ruby
# 検証: status=judgingで一部審査完了の場合、完了分のみ返る
it '審査中の投稿（status=judging, 一部審査完了）の詳細を取得できる' do
  post = create(:post, status: 'judging', judges_count: 1)
  create(:judgment, :hiroyuki, post_id: post.id)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['status']).to eq('judging')
  expect(json['judges_count']).to eq(1)
  expect(json['judgments'].length).to eq(1)
  expect(json['judgments'].first['persona']).to eq('hiroyuki')
  expect(json['rank']).to be_nil
  expect(json['average_score']).to be_nil
end
```

### テスト4: 審査失敗した投稿

```ruby
# 検証: status=failedでsucceeded=falseの審査結果が含まれる
it '審査失敗した投稿（status=failed）の詳細を取得できる' do
  post = create(:post, :failed, judges_count: 1)
  create(:judgment, :hiroyuki, post_id: post.id, succeeded: true)
  create(:judgment, :dewi, post_id: post.id, :failed, error_code: 'timeout')
  create(:judgment, :nakao, post_id: post.id, :failed, error_code: 'provider_error')

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['status']).to eq('failed')

  # 失敗した審査結果の検証
  dewi = json['judgments'].find { |j| j['persona'] == 'dewi' }
  expect(dewi['succeeded']).to be false
  expect(dewi['error_code']).to eq('timeout')
  expect(dewi['empathy']).to be_nil
  expect(dewi['total_score']).to be_nil
end
```

### テスト5: 一部の審査員のみ成功

```ruby
# 検証: succeeded混在ケースで各審査員の結果が正確に返る
it '一部の審査員のみ成功した投稿（succeeded混在）の詳細を取得できる' do
  post = create(:post, status: 'failed', judges_count: 2)
  create(:judgment, :hiroyuki, post_id: post.id, succeeded: true, total_score: 80)
  create(:judgment, :dewi, post_id: post.id, :failed, error_code: 'timeout')
  create(:judgment, :nakao, post_id: post.id, succeeded: true, total_score: 90)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body

  # 成功した審査員の検証
  hiroyuki = json['judgments'].find { |j| j['persona'] == 'hiroyuki' }
  expect(hiroyuki['succeeded']).to be true
  expect(hiroyuki['total_score']).to eq(80)
  expect(hiroyuki['error_code']).to be_nil

  # 失敗した審査員の検証
  dewi = json['judgments'].find { |j| j['persona'] == 'dewi' }
  expect(dewi['succeeded']).to be false
  expect(dewi['error_code']).to eq('timeout')
  expect(dewi['total_score']).to be_nil
end
```

### テスト6: 存在しない投稿ID

```ruby
# 検証: 存在しないUUIDで404 NOT_FOUNDが返る
it '存在しない投稿IDの場合404 NOT_FOUNDを返す' do
  non_existent_id = SecureRandom.uuid

  get "/api/posts/#{non_existent_id}"

  expect(response).to have_http_status(:not_found)
  json = response.parsed_body
  expect(json['error']).to eq('投稿が見つかりません')
  expect(json['code']).to eq('NOT_FOUND')
end
```

### テスト7: 不正なUUID形式

```ruby
# 検証: 不正な形式のIDで404 NOT_FOUNDが返る（500ではなく）
it '不正なUUID形式の場合404 NOT_FOUNDを返す' do
  invalid_ids = ['abc', '123', 'invalid-uuid', '!@#$%']

  invalid_ids.each do |invalid_id|
    get "/api/posts/#{invalid_id}"
    expect(response).to have_http_status(:not_found)
    json = response.parsed_body
    expect(json['code']).to eq('NOT_FOUND')
  end
end
```

### テスト8: 空文字列のID

```ruby
# 検証: 空文字列で404 NOT_FOUNDが返る
it '空文字列のIDの場合404 NOT_FOUNDを返す' do
  # Railsのルーティングにより /api/posts にマッチする可能性があるため
  # 実装時のルーティング挙動に合わせて調整
  get '/api/posts/'
  expect(response).to have_http_status(:not_found)
end
```

### テスト9: 唯一の投稿

```ruby
# 検証: scored投稿が1件のみの場合、rank: 1, total_count: 1
it '唯一の投稿（順位1位）の詳細を取得できる' do
  post = create(:post, :scored, average_score: 85.0)
  create(:judgment, :hiroyuki, post_id: post.id)
  create(:judgment, :dewi, post_id: post.id)
  create(:judgment, :nakao, post_id: post.id)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['rank']).to eq(1)
  expect(json['total_count']).to eq(1)
end
```

### テスト10: 同点の投稿が複数存在

```ruby
# 検証: 同点の場合created_atが早い方が上位になる
it '同点の投稿が複数存在する場合created_atの早い方が上位になる' do
  # 1つ目の投稿（早い）
  post1 = create(:post, :scored,
    average_score: 85.0,
    created_at: (Time.now - 10).to_i.to_s
  )
  create(:judgment, :hiroyuki, post_id: post1.id, total_score: 85)
  create(:judgment, :dewi, post_id: post1.id, total_score: 85)
  create(:judgment, :nakao, post_id: post1.id, total_score: 85)

  # 2つ目の投稿（遅い、同点）
  post2 = create(:post, :scored,
    average_score: 85.0,
    created_at: Time.now.to_i.to_s
  )
  create(:judgment, :hiroyuki, post_id: post2.id, total_score: 85)
  create(:judgment, :dewi, post_id: post2.id, total_score: 85)
  create(:judgment, :nakao, post_id: post2.id, total_score: 85)

  # 早い投稿は1位
  get "/api/posts/#{post1.id}"
  expect(response.parsed_body['rank']).to eq(1)
  expect(response.parsed_body['total_count']).to eq(2)

  # 遅い投稿は2位
  get "/api/posts/#{post2.id}"
  expect(response.parsed_body['rank']).to eq(2)
  expect(response.parsed_body['total_count']).to eq(2)
end
```

### テスト11: average_scoreが0.0

```ruby
# 検証: 最低点0.0の投稿が正しく処理される
it 'average_scoreが0.0の投稿（最低点）の詳細を取得できる' do
  post = create(:post, :scored, average_score: 0.0)
  create(:judgment, :hiroyuki, post_id: post.id, total_score: 0)
  create(:judgment, :dewi, post_id: post.id, total_score: 0)
  create(:judgment, :nakao, post_id: post.id, total_score: 0)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['average_score']).to eq(0.0)
  expect(json['rank']).to be_present
end
```

### テスト12: average_scoreが100.0

```ruby
# 検証: 満点100.0の投稿が正しく処理される
it 'average_scoreが100.0の投稿（満点）の詳細を取得できる' do
  post = create(:post, :scored, average_score: 100.0)
  create(:judgment, :hiroyuki, post_id: post.id, total_score: 100)
  create(:judgment, :dewi, post_id: post.id, total_score: 100)
  create(:judgment, :nakao, post_id: post.id, total_score: 100)

  get "/api/posts/#{post.id}"

  expect(response).to have_http_status(:ok)
  json = response.parsed_body
  expect(json['average_score']).to eq(100.0)
  expect(json['rank']).to eq(1) # 最高点なので1位
end
```

---

## 検証コマンド

```bash
# テスト実行（RED確認）
bundle exec rspec spec/requests/api/posts_show_spec.rb

# カバレッジ付き
COVERAGE=true bundle exec rspec spec/requests/api/posts_show_spec.rb
```

---

## RED状態の確認

テスト作成時点では以下の理由で失敗する:

1. ルーティング未定義（`show` アクションなし）
2. コントローラーアクション未実装（`PostsController#show` なし）
3. モデルメソッド未実装（`Post#to_detail_json`, `Post.total_scored_count` なし）

**期待されるエラー**: `ActionController::RoutingError: No route matches [GET] "/api/posts/xxx"`

---

## 参照ファイル

- `backend/spec/requests/api/posts_spec.rb` - 既存のPOSTテストパターン
- `backend/spec/factories/posts.rb` - Post factory (:scored, :failed traits)
- `backend/spec/factories/judgments.rb` - Judgment factory (:hiroyuki, :dewi, :nakao, :failed traits)
- `backend/app/models/post.rb` - Postモデル（calculate_rank既存）
- `backend/app/models/judgment.rb` - Judgmentモデル

---

## 次のステップ

1. このプランに基づいて `backend/spec/requests/api/posts_show_spec.rb` を作成
2. テストを実行してRED（失敗）を確認
3. GREEN フェーズで実装
