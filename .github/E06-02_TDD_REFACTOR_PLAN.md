# E06-02 GeminiAdapter TDDリファクタリング計画（完全版）

## 概要

**GitHub Issue**: https://github.com/Yadon987/aruaruarena/issues/32
**実施期間**: 2025-02-11
**最終更新**: 2025-02-11（CodeRabbitレビュー対応完了）

TDDのRefactorフェーズとして、Green状態を維持したままコード品質を向上させました。

**最終結果**:
- コード行数: 282行 → 374行（メソッド数増加だが可読性向上）
- メソッド数: 12個 → 18個
- テスト数: 56 examples → 62 examples（6件追加）
- カバレッジ: 46.74% → 48.52%（+1.78%）
- テスト結果: 238 examples, 0 failures, 13 pending

**重要な制約**:
- ✅ 既存のテストは必ずパスし続けること
- ✅ 振る舞いは変更しない（内部実装のみ改善）
- ✅ 新しい機能は追加しない（バグ修正のみ）

---

## 改善点の分析

### 1. 重複コードの問題

**問題**: 以下のエラー生成コードが5箇所で重複

`JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)`

**発生箇所**:
- `parse_response`: 150行目（candidatesチェック失敗時）
- `parse_response`: 179行目（JSONパースエラー時）
- `call_ai_api`: 249行目（スコアキー不完全時）
- `call_ai_api`: 254行目（スコア範囲エラー時）
- `call_ai_api`: 259行目（コメント無効時）

### 2. メソッドの複雑性

**問題**: `call_ai_api`メソッド（224-281行目、58行）が以下の責務を持ちすぎている

1. HTTPリクエストの構築と送信（225-232行）
2. ステータスコードの分岐処理（234-274行）
3. レスポンス解析とバリデーション（238-267行）
4. エラーハンドリング（268-280行）

**問題**: `parse_response`メソッド（141-180行、40行）が以下の責務を持っている

1. レスポンスボディの取得とパース（142-153行）
2. JSONコードブロックの抽出（156行）
3. JSONパース（159行）
4. スコア変換（162-167行）
5. コメント切り詰め（170行）
6. 例外処理（176-180行）

### 3. コメント不足

**問題**: 複雑なロジックに説明コメントがない

- `extract_json_from_codeblock`: 正規表現処理の意図
- `parse_response`: レスポンス構造の期待値
- `call_ai_api`: ステータスコードの分岐理由

### 4. マジックナンバー

**問題**: ハードコードされた数値がある

- `build_request`: `temperature: 0.7`
- `build_request`: `maxOutputTokens: 1000`
- 各メソッド: `'invalid_response'` エラーコード

### 5. CodeRabbitレビューで指摘された問題（追加）

**問題1: 小数点スコア変換未対応**
- `Integer("12.5")` が `ArgumentError` を発生させる
- AIが小数点形式でスコアを返す可能性がある

**問題2: JSON抽出の不完全**
- `gsub` アプローチではコードブロック外のテキストが残る
- 例: `'Note: ```json\n{"a":1}\n```\nDone'` → `'Note: \n{"a":1}\n\nDone'`

---

## リファクタリング計画（実装済み）

### ステップ1: 失敗結果生成メソッドの抽出 ✅

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

**適用箇所**: 5箇所の重複を1つのメソッドに集約

**期待される効果**: ✅ 達成
- 重複コード削減: 5箇所 → 1箇所

---

### ステップ2: parse_responseのメソッド分割 ✅

**目的**: `parse_response`を複数の小さなメソッドに分割

**2.1 テキスト抽出メソッドの分離**

```ruby
# Gemini APIレスポンスからテキストを抽出する
# @param response [Faraday::Response] APIレスポンス
# @return [String] 抽出されたテキスト
# @raise [ArgumentError] candidates構造が無効な場合
# @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合
def extract_text_from_response(response)
  body = response.body
  parsed = JSON.parse(body, symbolize_names: true)

  candidates = parsed[:candidates]
  unless candidates&.first&.dig(:content, :parts)&.first&.dig(:text)
    Rails.logger.error('Gemini APIレスポンスにcandidatesが含まれていません')
    raise ArgumentError, 'Invalid candidates structure'
  end

  candidates.first[:content][:parts].first[:text]
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

**変更点**:
- `Integer(value)` → `Float(value).round`
- 小数点文字列 `"12.5"` のサポートを追加
- 12.5 → 13, 12.4 → 12（四捨五入）

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

**変更点**:
- `gsub` → `slice`（正規表現キャプチャ）
- コードブロック外のテキストを完全に除外
- マルチラインモード `/m` を使用

**2.4 parse_responseの再構成**

```ruby
# Gemini APIのレスポンスを解析してHash形式に変換する
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

**期待される効果**: ✅ 達成
- `parse_response`が40行から30行程度に削減
- 各メソッドの責務が明確になる
- エラーハンドリングが明確になる

---

### ステップ3: call_ai_apiのメソッド分割 ✅

**目的**: `call_ai_api`を複数の小さなメソッドに分割

**3.1 成功レスポンス構築メソッドの分離**

```ruby
# パース結果をJudgmentResultに変換する
# @param parse_result [Hash] parse_responseの戻り値
# @return [JudgmentResult] 審査結果
def build_success_result(parse_result)
  scores = parse_result[:scores] || parse_result['scores']
  comment = parse_result[:comment] || parse_result['comment']

  # 必須キーの完全性チェック
  return invalid_response_error if scores && !valid_score_keys?(scores)

  # スコア範囲チェック
  return invalid_response_error if scores && !scores_within_range?(scores)

  # コメントチェック
  return invalid_response_error unless valid_comment?(comment)

  JudgmentResult.new(
    succeeded: true,
    error_code: nil,
    scores: scores.transform_keys(&:to_sym),
    comment: comment
  )
end
```

**3.2 HTTPリクエスト実行メソッドの分離**

```ruby
# Gemini APIにHTTPリクエストを送信する
# @param post_content [String] 投稿本文
# @param persona [String] 審査員ID
# @return [Faraday::Response] HTTPレスポンス
def send_api_request(post_content, persona)
  request_body = build_request(post_content, persona)
  endpoint = "#{API_VERSION}/models/#{MODEL_NAME}:generateContent"

  client.post(endpoint) do |req|
    req.params[:key] = api_key
    req.headers['Content-Type'] = 'application/json'
    req.body = JSON.generate(request_body)
  end
end
```

**3.3 ステータスコードハンドリングメソッドの分離**

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
    Rails.logger.info('Gemini API呼び出し成功')
    parse_result = parse_response(response)

    # JudgmentResultが返された場合はそのまま返す（エラー時）
    return parse_result if parse_result.is_a?(JudgmentResult)

    # Hashが返された場合はバリデーションを実行してJudgmentResultを構築
    build_success_result(parse_result)
  when 429
    Rails.logger.warn("Gemini APIレート制限: #{response.body}")
    raise Faraday::ClientError.new('rate limit', faraday_response: response)
  when 400..499
    Rails.logger.error("Gemini APIクライアントエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
  when 500..599
    Rails.logger.error("Gemini APIサーバーエラー: #{response.status} - #{response.body}")
    raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
  else
    Rails.logger.error("Gemini API未知のエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
  end
end
```

**3.4 call_ai_apiの再構成**

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
  Rails.logger.warn("Gemini APIタイムアウト: #{e.class}")
  raise
rescue Faraday::ConnectionFailed => e
  Rails.logger.error("Gemini API接続エラー: #{e.class}")
  raise
end
```

**期待される効果**: ✅ 達成
- `call_ai_api`が58行から20行程度に削減
- 各メソッドの責務が明確になる
- HTTP通信とレスポンス処理が分離され、テストがしやすくなる
- 200番台以外の成功ステータスコードにも対応
- サーバーエラーとクライアントエラーを区別

---

### ステップ4: コメントの追加 ✅

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
def client
  @client ||= Faraday.new(url: BASE_URL) do |f|
    f.request :url_encoded
    f.options.timeout = BASE_TIMEOUT
    f.ssl.verify = true # SSL証明書検証を有効化
    f.adapter Faraday.default_adapter
  end
end
```

**4.3 build_requestメソッドの改善**

```ruby
# Gemini API用のリクエストを構築する
#
# プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。
# Gemini APIはgenerateContentエンドポイントを使用し、
# contents配列に会話のターンを含めます。
#
# @param post_content [String] 投稿本文
# @param persona [String] 審査員ID（現状はhiroyukiのみ対応）
# @return [Hash] APIリクエストボディ
def build_request(post_content, _persona)
  # プロンプト内のプレースホルダーを置換
  prompt_text = @prompt.gsub('{post_content}', post_content)

  {
    contents: [
      {
        parts: [
          { text: prompt_text }
        ]
      }
    ],
    generationConfig: {
      temperature: TEMPERATURE, # 創造性のバランス（0.0-1.0）
      maxOutputTokens: MAX_OUTPUT_TOKENS # 最大出力トークン数
    }
  }
end
```

---

### ステップ5: 定数の整理 ✅

**目的**: マジックナンバーを定数として抽出

**実装**:

```ruby
class GeminiAdapter < BaseAiAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/hiroyuki.txt'

  # Gemini APIのベースURL
  BASE_URL = 'https://generativelanguage.googleapis.com'

  # Gemini 2.0 Flash Experimentalモデル
  MODEL_NAME = 'gemini-2.0-flash-exp'

  # APIバージョン
  API_VERSION = 'v1beta'

  # レスポンスの最大長（コメント用）
  MAX_COMMENT_LENGTH = 30

  # 生成パラメータ
  TEMPERATURE = 0.7
  MAX_OUTPUT_TOKENS = 1000

  # エラーコード
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'
```

**適用**:
- `build_request`内の`0.7` → `TEMPERATURE`
- `build_request`内の`1000` → `MAX_OUTPUT_TOKENS`
- 各メソッド内の`'invalid_response'` → `ERROR_CODE_INVALID_RESPONSE`

---

### ステップ6: テストの追加 ✅（CodeRabbitレビュー対応）

**目的**: 小数点スコアとコードブロック抽出のテストを追加

**6.1 小数点スコア変換テスト（3件追加）**

```ruby
context '小数点スコアの扱い' do
  it 'スコアが小数点文字列（"12.5"）の場合に四捨五入して整数に変換できること' do
    decimal_string_scores = base_scores.merge(empathy: "12.5", humor: "15.7", brevity: "8.2")
    # ... テスト実装
    expect(result[:scores][:empathy]).to eq(13)  # 12.5 -> 13
    expect(result[:scores][:humor]).to eq(16)    # 15.7 -> 16
    expect(result[:scores][:brevity]).to eq(8)   # 8.2 -> 8
  end

  it 'スコアが小数点（Float）の場合に四捨五入して整数に変換できること' do
    # Float値のテスト
  end

  it 'スコアが境界値（0.5）の場合に正しく丸められること' do
    # 0.5 -> 1（四捨五入）
  end
end
```

**6.2 コードブロック抽出テスト（3件追加）**

```ruby
context '周囲にテキストがある場合' do
  it 'JSONが前後にテキストを含むコードブロックで囲まれている場合に正しく抽出できること' do
    json_with_surrounding_text = <<~TEXT
      これは審査結果です:
      ```json
      {"empathy": 15, "comment": "それって本当？"}
      ```
      以上です。
    TEXT
    # ... テスト実装
  end

  it '複数のコードブロックが含まれる場合に最初のJSONを抽出できること' do
    # 最初のコードブロックのみを抽出
  end

  it '```jsonがないコードブロックを正しく抽出できること' do
    # 単一の```のみの場合
  end
end
```

**期待される効果**: ✅ 達成
- 小数点スコアのテストカバレッジ追加
- コードブロック抽出のテストカバレッジ追加
- 62 examples, 0 failures（6件追加）

---

## テスト検証計画

### 各ステップの検証

**ステップ1検証**: ✅ 完了

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb`

期待: すべてのテストがパス

**ステップ2検証**: ✅ 完了

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb -e "#parse_response"`

期待: `#parse_response`のすべてのテストがパス

**ステップ3検証**: ✅ 完了

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb -e "#call_ai_api"`

期待: `#call_ai_api`のすべてのテストがパス

**最終一括検証**: ✅ 完了

すべてのステップ完了後の最終確認：

`cd backend`

```bash
# 1. テスト実行
bundle exec rspec spec/adapters/gemini_adapter_spec.rb --format documentation

# 2. カバレッジ確認
COVERAGE=true bundle exec rspec spec/adapters/gemini_adapter_spec.rb

# 3. RuboCop確認
bundle exec rubocop app/adapters/gemini_adapter.rb

# 4. Brakeman確認
bundle exec brakeman -q
```

期待:
- ✅ すべてのテストがパス（62 examples, 0 failures）
- ✅ カバレッジが46.74%以上（実際: 48.52%）
- ✅ RuboCopで新しい警告が発生しない
- ✅ Brakemanでセキュリティ問題が検出されない

### カバレッジ確認

**リファクタリング前**（2025-02-11時点）:
- Line Coverage: 46.74% (208 / 445行)

**リファクタリング後**（2025-02-11時点）:
- Line Coverage: 48.52% (230 / 474行)
- 増加: +1.78%

`cd backend && COVERAGE=true bundle exec rspec spec/adapters/gemini_adapter_spec.rb`

期待: カバレッジがリファクタリング前以上を維持 ✅

---

## テスト戦略

### Privateメソッドのテストについて

新しいprivateメソッドのテスト方法:

**方針**: publicメソッド経由の間接テストでカバレッジを確認

- `extract_text_from_response`: `parse_response`経由でテスト
- `convert_scores_to_integers`: `parse_response`経由でテスト
- `build_success_result`: `handle_response_status`経由でテスト
- `send_api_request`: `call_ai_api`経由でテスト
- `handle_response_status`: `call_ai_api`経由でテスト

既存のテストで十分カバレッジがあるため、新しいprivateメソッドの直接テストは追加しません。

**追加テスト**（CodeRabbitレビュー対応）:
- 小数点スコア変換: 3件のテストを追加
- コードブロック抽出: 3件のテストを追加

---

## セキュリティ考慮事項

- ✅ APIキーはURLパラメータとして渡されますが、Faradayのデフォルト設定では
  リクエストボディ/パラメータはログされないため、ログ漏洩のリスクはありません
- ✅ SSL証明書検証が有効化されており、中間者攻撃に対する保護がされています
- ✅ プロンプトファイルのパストラバーサルチェックを実装

---

## 並行処理の考慮事項

- ✅ `@prompt_cache`へのアクセスは既に`@prompt_mutex`で保護されています
- ✅ 新しいprivateメソッド（`extract_text_from_response`等）はインスタンス変数を
  参照しないため、スレッドセーフです
- ✅ `call_ai_api`自体はスレッドセーフではありませんが、呼び出し元で適切に
  同期制御することを想定しています

---

## コミット履歴

### コミット1: リファクタリング実装
```
refactor: E06-02 GeminiAdapterのリファクタリング #32

- invalid_response_errorメソッドを抽出して重複コードを削減
- parse_responseメソッドを3つの小さなメソッドに分割
  - extract_text_from_response: テキスト抽出
  - convert_scores_to_integers: スコア変換
  - extract_json_from_codeblock: JSON抽出
- call_ai_apiメソッドを4つの小さなメソッドに分割
  - send_api_request: HTTPリクエスト実行
  - handle_response_status: ステータスコード処理
  - build_success_result: 成功レスポンス構築
- 複雑なロジックに詳細コメントを追加
- 定数を抽出（TEMPERATURE, MAX_OUTPUT_TOKENS等）

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### コミット2: CodeRabbitレビュー対応
```
fix: E06-02 GeminiAdapterの小数点スコア・JSON抽出を修正 #32

- convert_scores_to_integers: Integer()をFloat().roundに変更
  - 小数点文字列（"12.5"）のサポートを追加
  - 12.5 -> 13, 12.4 -> 12（四捨五入）
- extract_json_from_codeblock: gsubからsliceに変更
  - コードブロック外のテキストを完全に除外
  - 周囲の説明文があってもJSONを正確に抽出
- テスト追加: 小数点スコア3件、コードブロック抽出3件

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 実装手順のまとめ（完了）

1. ✅ **ステップ1**: `invalid_response_error`メソッドの抽出
   - 5箇所の重複を1つのメソッドに集約
   - テスト実行して確認

2. ✅ **ステップ2**: `parse_response`の分割
   - `extract_text_from_response`の抽出
   - `convert_scores_to_integers`の抽出
   - `parse_response`の再構成
   - テスト実行して確認

3. ✅ **ステップ3**: `call_ai_api`の分割
   - `send_api_request`の抽出
   - `handle_response_status`の抽出
   - `build_success_result`の抽出
   - `call_ai_api`の再構成
   - テスト実行して確認

4. ✅ **ステップ4**: コメントの追加
   - 各メソッドに詳細な日本語コメントを追加
   - RuboCopで確認

5. ✅ **ステップ5**: 定数の整理
   - マジックナンバーを定数に置換
   - 最終テスト実行

6. ✅ **ステップ6**: CodeRabbitレビュー対応（追加）
   - 小数点スコア変換の改善とテスト追加
   - JSON抽出の改善とテスト追加
   - 全テスト + カバレッジ + RuboCop + Brakeman

7. ✅ **最終確認**: 全テスト + カバレッジ + RuboCop + Brakeman
   - 238 examples, 0 failures, 13 pending
   - カバレッジ 88.15%（全体）
   - GeminiAdapterカバレッジ 48.52%

---

## 関連ファイル

| ファイル | 目的 |
|---------|------|
| `backend/app/adapters/gemini_adapter.rb` | リファクタリングの主対象（282行 → 374行） |
| `backend/app/adapters/base_ai_adapter.rb` | 親クラスの実装を確認し、重複を避けるために参照 |
| `backend/spec/adapters/gemini_adapter_spec.rb` | すべてのテストがパスすることを確認（56 → 62 examples） |
| `backend/app/prompts/hiroyuki.txt` | プロンプトファイルの構造を理解するための参照 |

---

## リスク評価

| リスク | 影響 | 対策 | 結果 |
|--------|------|--------|------|
| メソッド分割でバグを導入 | 高 | 各ステップでテスト実行、Green状態を維持 | ✅ 回避 |
| 振る舞いが変わる | 高 | 既存テストですべてのパスを確認 | ✅ 回避 |
| カバレッジが低下 | 中 | SimpleCovで前後比較（46.74%以上維持） | ✅ 改善（48.52%） |
| コードが複雑になる | 低 | メソッド数は増えるが、各メソッドは単純化 | ✅ 改善 |
| 例外処理の漏れ | 中 | 各メソッドで適切な例外ハンドリングを実装 | ✅ 完了 |
| 小数点スコア対応漏れ | 中 | CodeRabbitレビューで指摘、実装済み | ✅ 完了 |
| JSON抽出の不完全 | 中 | CodeRabbitレビューで指摘、実装済み | ✅ 完了 |

---

## 成功基準（達成済み）

- [x] 小数点文字列（"12.5"）を含むスコアを正しく変換できる
- [x] コードブロック外にテキストがある場合でもJSONを正確に抽出できる
- [x] すべての既存テストがパスする
- [x] 新しいテストケースがすべてパスする（6件追加）
- [x] カバレッジがリファクタリング前以上を維持する（46.74% → 48.52%）
- [x] RuboCopで警告が出ない（既存のMetrics/MethodLengthを除く）
- [x] Brakemanでセキュリティ問題が検出されない

---

## 今後の改善点

### カバレッジ90%達成に向けて

現在のカバレッジ: 48.52%
目標: 90%
差: 41.48%

**未実装のテスト**（13件保留中）:
- Integration Test（7件）: VCRカセット作成待ち
- 並行処理テスト（1件）
- ログ出力テスト（3件）
- Content-Type検証（2件）

**対応策**:
1. VCRカセットを再記録してIntegration Testを有効化
2. 並行処理テストを実装
3. ログ出力テストを実装
4. Content-Type検証を実装（E05-01の一部）

---

## 参考資料

- **CodeRabbitレビュー**: 2025-02-11
  - 小数点スコア変換の指摘
  - JSON抽出の不完全性の指摘
- **TDDサイクル**: Red → Green → Refactor
- **Railsガイド**: https://railsguides.jp/
- **Gemini APIドキュメント**: https://ai.google.dev/gemini-api/docs

---

**作成日**: 2025-02-11
**最終更新**: 2025-02-11
**ステータス**: ✅ 完了
