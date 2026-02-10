# E05-01 投稿バリデーション REFACTOR実装計画

## Context

TDDのRefactorフェーズとして、Green状態を維持したままコード品質を向上させます。
既存のテストはすべてパスしており、振る舞いは変更しません。

**現在の状況**:
- ✅ 57 examples, 0 failures, 1 pending
- ✅ すべてのテストがパス済み（Green）

**重要な制約**:
- 既存のテストは必ずパスし続けること
- 振る舞いは変更しない（内部実装のみ改善）
- エッジケースの追加実装はしない

---

## Refactor対象ファイル

| ファイル | 改善点 |
|---------|--------|
| `app/models/post.rb` | 定数抽出、重複排除、コメント追加 |
| `app/controllers/api/posts_controller.rb` | 定数抽出、メソッド抽出、重複排除 |

---

## 1. PostモデルのRefactor

### 1.1 定数の抽出

**問題**: 以下のマジックナンバーが散在している
- `1..20`（nickname長さ）
- `3..30`（body長さ）
- `0..3`（judges_count）
- `0..100`（average_score）
- `1000`（score_key計算用）
- `%w[judging scored failed]`（ステータス値）

**解決策**: クラス定数として抽出

```ruby
class Post
  # バリデーション定数
  NICKNAME_MIN_LENGTH = 1
  NICKNAME_MAX_LENGTH = 20
  BODY_MIN_LENGTH = 3
  BODY_MAX_LENGTH = 30
  JUDGES_COUNT_MIN = 0
  JUDGES_COUNT_MAX = 3
  AVERAGE_SCORE_MIN = 0
  AVERAGE_SCORE_MAX = 100

  # ステータス定数
  STATUS_JUDGING = 'judging'
  STATUS_SCORED = 'scored'
  STATUS_FAILED = 'failed'
  STATUSES = [STATUS_JUDGING, STATUS_SCORED, STATUS_FAILED].freeze

  # スコア計算定数
  SCORE_MULTIPLIER = 10
  SCORE_BASE = 1000

  # タイムスタンプ定数
  TIMESTAMP_FORMAT = :to_i_to_s
end
```

**適用箇所**:
```ruby
# field定義のデフォルト値
field :status, :string, default: STATUS_JUDGING
field :judges_count, :integer, default: JUDGES_COUNT_MIN

# バリデーション
validates :nickname, length: { in: NICKNAME_MIN_LENGTH..NICKNAME_MAX_LENGTH, ... }
validates :status, inclusion: { in: STATUSES }
validates :judges_count, numericality: {
  greater_than_or_equal_to: JUDGES_COUNT_MIN,
  less_than_or_equal_to: JUDGES_COUNT_MAX
}
validates :average_score, numericality: {
  greater_than_or_equal_to: AVERAGE_SCORE_MIN,
  less_than_or_equal_to: AVERAGE_SCORE_MAX
}

# score_key計算
def generate_score_key
  return nil if average_score.blank?
  inv_score = SCORE_BASE - (average_score * SCORE_MULTIPLIER).round
  format('%<s1>04d#%<s2>010d#%<s3>s', s1: inv_score, s2: created_at, s3: id)
end
```

### 1.2 重複排除

**問題**: `body_grapheme_length` で同じエラーメッセージを2回設定

**解決策**: 条件分岐を統一

```ruby
# 本文のgrapheme数バリデーション（3-30文字）
def body_grapheme_length
  return if body.blank?

  length = body.grapheme_clusters.length
  return unless length < BODY_MIN_LENGTH || length > BODY_MAX_LENGTH

  errors.add(:body, 'は3〜30文字で入力してください')
end
```

### 1.3 タイムスタンプ生成のメソッド抽出

**問題**: `set_created_at`で`Time.now.to_i.to_s`という実装があるが、意図が明確でない

**解決策**: タイムスタンプ生成をメソッド化

```ruby
# 作成日時を設定（UnixTimestampを文字列として保存）
def set_created_at
  self.created_at ||= current_timestamp
end

# 現在のUnixタイムスタンプを文字列として返す
# @return [String] UnixTimestamp（例: "1738041600"）
def current_timestamp
  Time.now.to_i.to_s
end
```

### 1.4 I18n対応（オプション）

**問題**: バリデーションメッセージがハードコード

**解決策**: `config/locales/ja.yml` を作成してロケールテキストを移動

**実装**:
```yaml
# config/locales/ja.yml
ja:
  activemodel:
    errors:
      models:
        post:
          attributes:
            nickname:
              blank: "を入力してください"
              too_long: "は%{count}文字以内で入力してください"
            body:
              blank: "を入力してください"
            judges_count:
              blank: "を入力してください"
            created_at:
              blank: "を入力してください"
```

**注意**:
- これはRuboCopの `Rails/I18nLocaleTexts` 警告を解消するための改善です
- I18n対応は別Issueとして切り出すことを推奨（振る舞い変更のリスク回避）
- 実施する場合は、モデルの`validates`から`message:`オプションを削除すること

---

## 2. PostsControllerのRefactor

### 2.1 定数の抽出

**問題**: エラーコードがハードコード

**解決策**: クラス定数として抽出

```ruby
module Api
  class PostsController < ApplicationController
    # エラーコード定数
    ERROR_CODE_VALIDATION = 'VALIDATION_ERROR'
    ERROR_CODE_BAD_REQUEST = 'BAD_REQUEST'

    # エラーメッセージ定数
    ERROR_MESSAGE_INVALID_REQUEST = 'リクエスト形式が正しくありません'
    FIELD_LABEL_NICKNAME = 'ニックネーム'
    FIELD_LABEL_BODY = '本文'
  end
end
```

### 2.2 メソッド抽出

**問題**: エラーメッセージのフィールド名追加ロジックが複雑

**解決策**: プライベートメソッドとして抽出

```ruby
# エラーメッセージにフィールド名を追加する
# @param post [Post] バリデーション失敗した投稿オブジェクト
# @return [String] フィールド名付きエラーメッセージ
def build_error_message(post)
  error_message = post.errors[:nickname].first ||
                  post.errors[:body].first ||
                  post.errors.full_messages.first

  if post.errors[:nickname].first
    "#{FIELD_LABEL_NICKNAME}#{error_message}"
  elsif post.errors[:body].first
    "#{FIELD_LABEL_BODY}#{error_message}"
  else
    error_message
  end
end
```

**適用後のcreateアクション**:
```ruby
def create
  post = Post.new(post_params)
  post.id = SecureRandom.uuid

  unless post.valid?
    render json: {
      error: build_error_message(post),
      code: ERROR_CODE_VALIDATION
    }, status: :unprocessable_content
    return
  end

  post.save!
  render json: { id: post.id, status: post.status }, status: :created
rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
  render_bad_request
end
```

### 2.3 重複排除

**問題**: 2つの rescue ブロックが同じ処理

**解決策**: 共通のレスポンスメソッドを抽出

```ruby
# 不正なリクエストのエラーレスポンスを返す
# @return [void] JSONレスポンスをレンダリング
def render_bad_request
  render json: {
    error: ERROR_MESSAGE_INVALID_REQUEST,
    code: ERROR_CODE_BAD_REQUEST
  }, status: :bad_request
end
```

---

## 3. コメント追加

複雑なロジックに日本語コメントを追加します。

### 3.1 sanitize_inputs

```ruby
# 入力のサニタイズ（前後の空白のみ除去）
#
# POSIX文字クラス [[:space:]] は、半角空白（U+0020）と全角空白（U+3000）の両方にマッチ
# \A[[:space:]]+ で先頭の空白、[[:space:]]+\z で末尾の空白を除去
# 内部の空白は保持する（連続する空白やタブ・改行はそのまま）
#
# @example 前後の半角空白を除去
#   sanitize_inputs #=> "太郎" (元: " 太郎 ")
# @example 前後の全角空白を除去
#   sanitize_inputs #=> "太郎" (元: "　太郎　")
# @example 内部の空白は保持
#   sanitize_inputs #=> "太　郎" (元: "太　郎")
def sanitize_inputs
  self.nickname = nickname&.gsub(/\A[[:space:]]+|[[:space:]]+\z/, '')
  self.body = body&.gsub(/\A[[:space:]]+|[[:space:]]+\z/, '')
end
```

### 3.2 body_grapheme_length

```ruby
# 本文のgrapheme数バリデーション（3-30文字）
#
# grapheme単位でカウントすることで、絵文字・結合文字・修飾子を正しく1文字としてカウント
#
# - 絵文字（😀😀😀）: 3 grapheme
# - 結合絵文字（👨‍👩‍👧‍👦）: 1 grapheme（7 codepointsだが1書記素）
# - 絵文字修飾子（👨🏻‍💻）: 1 grapheme（5 codepointsだが1書記素）
#
# @see docs/db_schema.md バリデーション仕様
def body_grapheme_length
  return if body.blank?

  # String#grapheme_clusters でUnicodeのgrapheme clusters（書記素クラスタ）を取得
  length = body.grapheme_clusters.length
  return unless length < BODY_MIN_LENGTH || length > BODY_MAX_LENGTH

  errors.add(:body, 'は3〜30文字で入力してください')
end
```

---

## 4. テスト確認

**方針**: エッジケースの追加実装はしないため、テスト追加はありません。
既存のテストがすべてパスすることを確認します。

### 4.1 Refactor前のテスト結果を保存

```bash
# Refactor前にテスト実行
cd /home/nukon/ws/aruaruarena/backend && bundle exec rspec spec/requests/api/posts_spec.rb spec/models/post_spec.rb --format documentation > /tmp/before_refactor.txt
cat /tmp/before_refactor.txt
```

**期待される結果**: 57 examples, 0 failures, 1 pending

### 4.2 Refactor後のテスト結果を比較

```bash
# Refactor後にテスト実行
cd /home/nukon/ws/aruaruarena/backend && bundle exec rspec spec/requests/api/posts_spec.rb spec/models/post_spec.rb --format documentation > /tmp/after_refactor.txt
cat /tmp/after_refactor.txt

# 差分確認（失敗数やpending数が変わっていないことを確認）
diff /tmp/before_refactor.txt /tmp/after_refactor.txt
```

### 4.3 カバレッジ確認

```bash
# SimpleCovでカバレッジが低下していないことを確認
COVERAGE=true bundle exec rspec
open coverage/index.html
```

**期待される結果**: カバレッジがRefactor前と同等以上

---

## 5. 確認コマンド

### 5.1 テスト実行

```bash
# 全テストを実行
scripts/test_all.sh

# または直接RSpecを実行
cd /home/nukon/ws/aruaruarena/backend && bundle exec rspec spec/requests/api/posts_spec.rb spec/models/post_spec.rb --format documentation
```

**期待される結果**: 57 examples, 0 failures, 1 pending

### 5.2 Lintチェック

```bash
cd /home/nukon/ws/aruaruarena/backend && bundle exec rubocop app/models/post.rb app/controllers/api/posts_controller.rb
```

**期待される結果**:
- `Rails/I18nLocaleTexts` 警告が解消（I18n対応の場合）
- または、Refactor前と同じ警告数（I18n未対応の場合）

---

## 6. コミットメッセージ

```text
refactor: E05-01 投稿バリデーションのリファクタリング

- Postモデルにバリデーション定数を抽出（NICKNAME_MIN_LENGTH等）
- Postモデルにステータス定数を抽出（STATUS_JUDGING等）
- Postモデルのbody_grapheme_lengthの重複排除
- Postモデルのset_created_atをメソッド抽出
- sanitize_inputsに詳細コメントを追加
- body_grapheme_lengthにgrapheme説明コメントを追加
- PostsControllerにエラーコード定数を抽出
- PostsControllerにフィールドラベル定数を抽出
- エラーメッセージ生成ロジックをbuild_error_messageとしてメソッド化
- 共通のエラーレスポンスメソッド（render_bad_request）を抽出

Refs: E05-01 Issue
```

---

## 7. 次のフェーズ（REFACTOR完了後）

REFACTOR完了後、以下の改善を検討：

1. **I18n対応**（別Issue推奨）
   - `config/locales/ja.yml` の作成
   - モデルのバリデーションから`message:`オプションを削除
   - 振る舞い regression テストの追加

2. **Content-Type検証の追加**（E05-01 Issueの未完了項目）
   - 415 Unsupported Media Type の返却
   - `ActionController::UnknownFormat` の rescue

3. **ログ出力の追加**（E05-01 Issueの非機能要件）
   - バリデーションエラー時のWARNレベルログ
   - フォーマット: `[PostController] Validation failed: nickname_len=#{len}, body_grapheme_len=#{len}, errors=#{errors}`

4. **エラーハンドリングの共通化**
   - Concerns抽出（ApiErrorHandler等）
   - 他のコントローラーでも再利用可能に
