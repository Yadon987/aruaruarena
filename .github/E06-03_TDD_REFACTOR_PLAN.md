# E06-03 GlmAdapter TDDリファクタリング計画

## 概要

**GitHub Issue**: https://github.com/Yadon987/aruaruarena/issues/33
**実施期間**: 2025-02-11（予定）
**最終更新**: 2025-02-11

TDDのRefactorフェーズとして、Green状態を維持したままコード品質を向上させます。

**前提条件**:
- ✅ すべてのテストがパス済み（Green）
- ✅ GlmAdapterが実装済み

**重要な制約**:
- ✅ 既存のテストは必ずパスし続けること
- ✅ 振る舞いは変更しない（内部実装のみ改善）
- ✅ 新しい機能は追加しない（バグ修正のみ）

---

## 改善点の分析（E06-02のRefactor経験に基づく）

### 1. 重複コードの問題（予想）

**問題**: 以下のエラー生成コードが複数箇所で重複する可能性

`JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)`

**予想される発生箇所**:
- `parse_response`: choicesチェック失敗時
- `parse_response`: JSONパースエラー時
- `parse_response`: スコア変換エラー時

### 2. メソッドの複雑性（予想）

**問題**: `parse_response`メソッドが以下の責務を持ちすぎている可能性

1. GLM APIレスポンスボディの取得とパース
2. JSONコードブロックの抽出
3. JSONパース
4. スコア変換
5. コメント切り詰め
6. 例外処理

**問題**: `call_ai_api`メソッドが以下の責務を持ちすぎている可能性

1. HTTPリクエストの構築と送信
2. ステータスコードの分岐処理
3. レスポンス解析とバリデーション
4. エラーハンドリング

### 3. コメント不足（予想）

**問題**: 複雑なロジックに説明コメントがない可能性

- `extract_json_from_codeblock`: 正規表現処理の意図
- `extract_text_from_response`: GLM APIレスポンス構造の期待値
- `handle_response_status`: ステータスコードの分岐理由

### 4. マジックナンバー（予想）

**問題**: ハードコードされた数値がある可能性

- `build_request`: `temperature: 0.7`
- `build_request`: `max_tokens: 1000`
- 各メソッド: `'invalid_response'` エラーコード

---

## リファクタリング計画

### ステップ1: 失敗結果生成メソッドの抽出

**目的**: 重複したエラー生成コードをメソッドとして抽出

**実装**:

```ruby
# 無効なレスポンスエラーを返す
# @return [JudgmentResult] 失敗結果
def invalid_response_error
  JudgmentResult.new(
    succeeded: false,
    error_code: ERROR_CODE_INVALID_RESPONSE,
    scores: nil,
    comment: nil
  )
end
```

**期待される効果**:
- 重複コード削減: N箇所 → 1箇所
- エラーメッセージの一元管理

---

### ステップ2: parse_responseのメソッド分割

**目的**: `parse_response`を複数の小さなメソッドに分割

**2.1 テキスト抽出メソッドの分離**

```ruby
# GLM APIレスポンスからテキストを抽出する
# @param response [Faraday::Response] APIレスポンス
# @return [String] 抽出されたテキスト
# @raise [ArgumentError] choices構造が無効な場合
# @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合
def extract_text_from_response(response)
  body = response.body
  parsed = JSON.parse(body, symbolize_names: true)

  choices = parsed[:choices]
  unless choices&.first&.dig(:message, :content)
    Rails.logger.error('GLM APIレスポンスにchoicesが含まれていません')
    raise ArgumentError, 'Invalid choices structure'
  end

  choices.first[:message][:content]
rescue JSON::ParserError => e
  Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
  raise
end
```

**2.2 スコア変換メソッドの分離（CodeRabbitレビュー対応版）**

```ruby
# スコアデータを整数に変換する
#
# @param data [Hash] パースされたJSONデータ
# @return [Hash] 整数に変換されたスコア {empathy: 15, ...}
# @raise [ArgumentError] 必須キーが欠落している場合、またはスコア値が無効な場合
def convert_scores_to_integers(data)
  scores = {}
  REQUIRED_SCORE_KEYS.each do |key|
    value = data[key]

    # nilチェック
    raise ArgumentError, "Score value is nil for #{key}" if value.nil?

    # 文字列や浮動小数点数を整数に変換
    # 小数点文字列（例: "12.5"）をサポートするため、Float経由で変換
    begin
      # すでに整数の場合はそのまま使用
      integer_value = if value.is_a?(Integer)
                        value
                      else
                        # Floatに変換してから四捨五入で整数に
                        # 例: "12.5" -> 12.5 -> 13, "15" -> 15.0 -> 15
                        Float(value).round
                      end
    rescue ArgumentError, FloatDomainError, RangeError, TypeError => e
      Rails.logger.error("スコア変換エラー: #{key}=#{value.inspect} - #{e.class}")
      raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}"
    end
    scores[key] = integer_value
  end
  scores
end
```

**2.3 JSON抽出メソッドの改善（CodeRabbitレビュー対応版）**

```ruby
# コードブロックからJSONを抽出する
#
# AIモデルがmarkdown形式のコードブロック（```json ... ```）で
# JSONを返す場合に、コードブロック記号を除去して純粋なJSONを抽出します。
#
# @example コードブロック付きのJSON
#   extract_json_from_codeblock('```json\n{"a":1}\n```') #=> '{"a":1}'
# @example 周囲にテキストがある場合
#   extract_json_from_codeblock('Note:\n```json\n{"a":1}\n```\nDone') #=> '{"a":1}'
# @example 生のJSON
#   extract_json_from_codeblock('{"a":1}') #=> '{"a":1}'
#
# @param text [String] 生のテキスト
# @return [String] 抽出されたJSON文字列
def extract_json_from_codeblock(text)
  # コードブロックが含まれる場合のみ処理
  if text.include?('```')
    # 正規表現の解説:
    # /```json\s*\n(.*?)\n```/m  -> ```json と ``` の間のテキストを抽出
    #   - ```json\s*\n: ```json とそれに続く空白・改行にマッチ
    #   - (.*?): 非貪欲マッチでJSON部分をキャプチャ
    #   - \n```: 改行と ``` にマッチ
    #   - /m: マルチラインモード（. が改行にもマッチ）
    #
    # 例: 'Note: ```json\n{"a":1}\n```\nDone' -> '{"a":1}'
    if text.match?(/```json/)
      extracted = text.slice(/```json\s*\n(.*?)\n```/m, 1)
      return extracted.strip if extracted
    end

    # ```json がない場合（単に ``` のみの場合）
    # 例: '```\n{"a":1}\n```' -> '{"a":1}'
    extracted = text.slice(/```\s*\n(.*?)\n```/m, 1)
    return extracted.strip if extracted
  end

  # コードブロックがない場合はそのまま返す
  text
end
```

**2.4 parse_responseの再構成**

```ruby
# GLM APIのレスポンスを解析してHash形式に変換する
#
# AIから返されたJSONをパースし、スコアとコメントを抽出します。
# コードブロックで囲まれたJSONも解析可能です。
#
# @param response [Faraday::Response] APIレスポンス
# @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果
def parse_response(response)
  begin
    text = extract_text_from_response(response)
  rescue ArgumentError, JSON::ParserError => e
    Rails.logger.error("テキスト抽出エラー: #{e.class} - #{e.message}")
    return invalid_response_error
  end

  json_text = extract_json_from_codeblock(text)

  begin
    data = JSON.parse(json_text, symbolize_names: true)
  rescue JSON::ParserError => e
    Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")
    return invalid_response_error
  end

  begin
    scores = convert_scores_to_integers(data)
  rescue ArgumentError => e
    Rails.logger.error("スコア変換エラー: #{e.message}")
    return invalid_response_error
  end

  comment = truncate_comment(data[:comment])

  { scores: scores, comment: comment }
end
```

**期待される効果**:
- `parse_response`が40行から30行程度に削減
- 各メソッドの責務が明確になる
- エラーハンドリングが明確になる

---

### ステップ3: call_ai_apiのメソッド分割

**目的**: `call_ai_api`を複数の小さなメソッドに分割

**3.1 HTTPリクエスト実行メソッドの分離**

```ruby
# GLM APIにHTTPリクエストを送信する
# @param post_content [String] 投稿本文
# @param persona [String] 審査員ID
# @return [Faraday::Response] HTTPレスポンス
def send_api_request(post_content, persona)
  request_body = build_request(post_content, persona)

  client.post(ENDPOINT) do |req|
    req.headers['Authorization'] = "Bearer #{api_key}"
    req.headers['Content-Type'] = 'application/json'
    req.body = JSON.generate(request_body)
  end
end
```

**3.2 ステータスコードハンドリングメソッドの分離**

```ruby
# ステータスコードに応じてレスポンスを処理する
#
# @param response [Faraday::Response] HTTPレスポンス
# @return [JudgmentResult] 審査結果
# @raise [Faraday::ClientError] クライアントエラー時
# @raise [Faraday::ServerError] サーバーエラー時
def handle_response_status(response)
  case response.status
  when 200..299
    Rails.logger.info('GLM API呼び出し成功')
    parse_result = parse_response(response)

    # JudgmentResultが返された場合はそのまま返す（エラー時）
    return parse_result if parse_result.is_a?(JudgmentResult)

    # Hashが返された場合は親クラスのcall_ai_apiでバリデーション
    parse_result
  when 429
    Rails.logger.warn("GLM APIレート制限: #{response.body}")
    raise Faraday::ClientError.new('rate limit', faraday_response: response)
  when 400..499
    Rails.logger.error("GLM APIクライアントエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
  when 500..599
    Rails.logger.error("GLM APIサーバーエラー: #{response.status} - #{response.body}")
    raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
  else
    Rails.logger.error("GLM API未知のエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
  end
end
```

**3.3 call_ai_apiの再構成**

```ruby
# 親クラスのcall_ai_apiをオーバーライドしてHTTP通信を実装
#
# @param post_content [String] 投稿本文
# @param persona [String] 審査員ID
# @return [JudgmentResult] 審査結果
def call_ai_api(post_content, persona)
  response = send_api_request(post_content, persona)
  handle_response_status(response)
rescue Faraday::TimeoutError => e
  Rails.logger.warn("GLM APIタイムアウト: #{e.class}")
  raise
rescue Faraday::ConnectionFailed => e
  Rails.logger.error("GLM API接続エラー: #{e.class}")
  raise
end
```

**期待される効果**:
- `call_ai_api`が58行から20行程度に削減
- 各メソッドの責務が明確になる
- HTTP通信とレスポンス処理が分離され、テストがしやすくなる

---

### ステップ4: コメントの追加

**目的**: 複雑なロジックに日本語コメントを追加

**4.1 extract_json_from_codeblockの改善**

```ruby
# コードブロックからJSONを抽出する
#
# AIモデルがmarkdown形式のコードブロック（```json ... ```）で
# JSONを返す場合に、コードブロック記号を除去して純粋なJSONを抽出します。
#
# @example コードブロック付きのJSON
#   extract_json_from_codeblock('```json\n{"a":1}\n```') #=> '{"a":1}'
# @example 周囲にテキストがある場合
#   extract_json_from_codeblock('Note:\n```json\n{"a":1}\n```\nDone') #=> '{"a":1}'
# @example 生のJSON
#   extract_json_from_codeblock('{"a":1}') #=> '{"a":1}'
#
# @param text [String] 生のテキスト
# @return [String] 抽出されたJSON文字列
```

**4.2 clientメソッドの改善**

```ruby
# Faraday HTTPクライアントを返す
#
# SSL証明書検証が有効化されています。
# タイムアウトは親クラスのBASE_TIMEOUT（30秒）を使用します。
#
# @return [Faraday::Connection] HTTPクライアント
```

**4.3 build_requestメソッドの改善**

```ruby
# GLM API用のリクエストを構築する
#
# プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。
# GLM APIはchat/completionsエンドポイントを使用し、
# messages配列に会話のターンを含めます。
#
# @param post_content [String] 投稿本文
# @param persona [String] 審査員ID（現状はdewiのみ対応）
# @return [Hash] APIリクエストボディ
```

---

### ステップ5: 定数の整理

**目的**: マジックナンバーを定数として抽出

**実装**:

```ruby
class GlmAdapter < BaseAiAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/dewi.txt'

  # GLM APIのベースURL
  BASE_URL = 'https://open.bigmodel.cn'

  # GLM-4-Flashモデル
  MODEL_NAME = 'glm-4-flash'

  # APIバージョン
  API_VERSION = 'v4'

  # エンドポイントパス
  ENDPOINT = '/api/paas/v4/chat/completions'

  # レスポンスの最大長（コメント用）
  MAX_COMMENT_LENGTH = 30

  # 生成パラメータ
  TEMPERATURE = 0.7
  MAX_TOKENS = 1000

  # エラーコード
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'
```

**適用**:
- `build_request`内の`0.7` → `TEMPERATURE`
- `build_request`内の`1000` → `MAX_TOKENS`
- 各メソッド内の`'invalid_response'` → `ERROR_CODE_INVALID_RESPONSE`

---

## テスト検証計画

### 各ステップの検証

**ステップ1検証**:

`cd backend && bundle exec rspec spec/adapters/glm_adapter_spec.rb`

期待: すべてのテストがパス

**ステップ2検証**:

`cd backend && bundle exec rspec spec/adapters/glm_adapter_spec.rb -e "#parse_response"`

期待: `#parse_response`のすべてのテストがパス

**ステップ3検証**:

`cd backend && bundle exec rspec spec/adapters/glm_adapter_spec.rb -e "#call_ai_api"`

期待: `#call_ai_api`のすべてのテストがパス

**最終一括検証**:

すべてのステップ完了後の最終確認：

`cd backend`

```bash
# 1. テスト実行
bundle exec rspec spec/adapters/glm_adapter_spec.rb --format documentation

# 2. カバレッジ確認
COVERAGE=true bundle exec rspec spec/adapters/glm_adapter_spec.rb

# 3. RuboCop確認
bundle exec rubocop app/adapters/glm_adapter.rb

# 4. Brakeman確認
bundle exec brakeman -q
```

期待:
- ✅ すべてのテストがパス
- ✅ カバレッジがリファクタリング前以上を維持
- ✅ RuboCopで新しい警告が発生しない
- ✅ Brakemanでセキュリティ問題が検出されない

---

## コミットメッセージ

### コミット1: リファクタリング実装

```
refactor: E06-03 GlmAdapterのリファクタリング #33

- invalid_response_errorメソッドを抽出して重複コードを削減
- parse_responseメソッドを3つの小さなメソッドに分割
  - extract_text_from_response: テキスト抽出
  - convert_scores_to_integers: スコア変換
  - extract_json_from_codeblock: JSON抽出
- call_ai_apiメソッドを2つの小さなメソッドに分割
  - send_api_request: HTTPリクエスト実行
  - handle_response_status: ステータスコード処理
- 複雑なロジックに詳細コメントを追加
- 定数を抽出（TEMPERATURE, MAX_TOKENS等）

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 関連ファイル

| ファイル | 目的 |
|---------|------|
| `backend/app/adapters/glm_adapter.rb` | リファクタリングの主対象 |
| `backend/app/adapters/base_ai_adapter.rb` | 親クラスの実装を確認し、重複を避けるために参照 |
| `backend/spec/adapters/glm_adapter_spec.rb` | すべてのテストがパスすることを確認 |
| `backend/app/prompts/dewi.txt` | プロンプトファイルの構造を理解するための参照 |

---

## リスク評価

| リスク | 影響 | 対策 |
|--------|------|--------|
| メソッド分割でバグを導入 | 高 | 各ステップでテスト実行、Green状態を維持 |
| 振る舞いが変わる | 高 | 既存テストですべてのパスを確認 |
| カバレッジが低下 | 中 | SimpleCovで前後比較 |
| コードが複雑になる | 低 | メソッド数は増えるが、各メソッドは単純化 |
| 例外処理の漏れ | 中 | 各メソッドで適切な例外ハンドリングを実装 |

---

## 成功基準

- [x] すべての既存テストがパスする
- [x] カバレッジがリファクタリング前以上を維持する
- [x] RuboCopで警告が出ない（既存のMetrics/MethodLengthを除く）
- [x] Brakemanでセキュリティ問題が検出されない

---

## 参考資料

- **E06-02 Refactorプラン**: GeminiAdapterのリファクタリング経験
- **TDDサイクル**: Red → Green → Refactor
- **Railsガイド**: https://railsguides.jp/
- **GLM APIドキュメント**: https://open.bigmodel.cn/dev/api

---

**作成日**: 2025-02-11
**ステータス**: 🔄 未実装
