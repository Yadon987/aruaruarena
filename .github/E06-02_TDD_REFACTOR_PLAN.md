# E06-02 GeminiAdapter TDDリファクタリング計画

## 概要

**GitHub Issue**: https://github.com/Yadon987/aruaruarena/issues/32

TDDのRefactorフェーズとして、Green状態を維持したままコード品質を向上させます。現在のGeminiAdapterはすべてのテストがパスしていますが、以下の改善点があります。

**現在の状況**:
- 282行のコード（`gemini_adapter.rb`）
- `call_ai_api`メソッドが58行と長大
- 重複したエラー生成コードが5箇所存在
- `parse_response`メソッドが40行で複雑

**重要な制約**:
- 既存のテストは必ずパスし続けること
- 振る舞いは変更しない（内部実装のみ改善）
- 新しい機能は追加しない

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

---

## リファクタリング計画

### ステップ1: 失敗結果生成メソッドの抽出

**目的**: 重複したエラー生成コードをメソッドとして抽出

**実装**:

`# 無効なレスポンスエラーを返す`
`# @return [JudgmentResult] 失敗結果`
`def invalid_response_error`
`  JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)`
`end`

**適用箇所**:
- `parse_response` 150行目
- `parse_response` 179行目
- `call_ai_api` 249行目
- `call_ai_api` 254行目
- `call_ai_api` 259行目

**期待される効果**: 5箇所の重複が1つのメソッドに集約

**検証方法**:

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb`

---

### ステップ2: parse_responseのメソッド分割

**目的**: `parse_response`を複数の小さなメソッドに分割

**2.1 テキスト抽出メソッドの分離**

`# Gemini APIレスポンスからテキストを抽出する`
`# @param response [Faraday::Response] APIレスポンス`
`# @return [String] 抽出されたテキスト`
`# @raise [ArgumentError] candidates構造が無効な場合`
`# @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合`
`def extract_text_from_response(response)`
`  body = response.body`
`  parsed = JSON.parse(body, symbolize_names: true)`

`  candidates = parsed[:candidates]`
`  unless candidates&.first&.dig(:content, :parts)&.first&.dig(:text)`
`    Rails.logger.error('Gemini APIレスポンスにcandidatesが含まれていません')`
`    raise ArgumentError, 'Invalid candidates structure'`
`  end`

`  candidates.first[:content][:parts].first[:text]`
`rescue JSON::ParserError => e`
`  Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")`
`  raise`
`end`

**2.2 スコア変換メソッドの分離**

`# スコアデータを整数に変換する`
`# @param data [Hash] パースされたJSONデータ`
`# @return [Hash] 整数に変換されたスコア {empathy: 15, ...}`
`# @raise [ArgumentError] 必須キーが欠落している場合、またはスコア値が無効な場合`
`def convert_scores_to_integers(data)`
`  scores = {}`
`  REQUIRED_SCORE_KEYS.each do |key|`
`    value = data[key]`
    `# 文字列や浮動小数点数を整数に変換`
`    begin`
`      integer_value = value.is_a?(Integer) ? value : Integer(value)`
`    rescue ArgumentError, FloatDomainError, RangeError => e`
`      Rails.logger.error("スコア変換エラー: #{key}=#{value.inspect} - #{e.class}")`
`      raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}"`
`    end`
`    scores[key] = integer_value`
`  end`
`  scores`
`end`

**2.3 parse_responseの再構成**

`# Gemini APIのレスポンスを解析してHash形式に変換する`
`#`
`# AIから返されたJSONをパースし、スコアとコメントを抽出します。`
`# コードブロックで囲まれたJSONも解析可能です。`
`#`
`# @param response [Faraday::Response] APIレスポンス`
`# @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果`
`def parse_response(response)`
`  begin`
`    text = extract_text_from_response(response)`
`  rescue ArgumentError, JSON::ParserError => e`
`    Rails.logger.error("テキスト抽出エラー: #{e.class} - #{e.message}")`
`    return invalid_response_error`
`  end`

`  json_text = extract_json_from_codeblock(text)`

`  begin`
`    data = JSON.parse(json_text, symbolize_names: true)`
`  rescue JSON::ParserError => e`
`    Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")`
`    return invalid_response_error`
`  end`

`  begin`
`    scores = convert_scores_to_integers(data)`
`  rescue ArgumentError => e`
`    Rails.logger.error("スコア変換エラー: #{e.message}")`
`    return invalid_response_error`
`  end`

`  comment = truncate_comment(data[:comment])`

`  { scores: scores, comment: comment }`
`end`

**期待される効果**:
- `parse_response`が40行から30行程度に削減
- 各メソッドの責務が明確になる
- エラーハンドリングが明確になる

**検証方法**:

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb -e "#parse_response"`

---

### ステップ3: call_ai_apiのメソッド分割

**目的**: `call_ai_api`を複数の小さなメソッドに分割

**3.1 成功レスポンス構築メソッドの分離**

`# パース結果をJudgmentResultに変換する`
`# @param parse_result [Hash] parse_responseの戻り値`
`# @return [JudgmentResult] 審査結果`
`def build_success_result(parse_result)`
`  scores = parse_result[:scores] || parse_result['scores']`
`  comment = parse_result[:comment] || parse_result['comment']`

`  # 必須キーの完全性チェック`
`  return invalid_response_error if scores && !valid_score_keys?(scores)`

`  # スコア範囲チェック`
`  return invalid_response_error if scores && !scores_within_range?(scores)`

`  # コメントチェック`
`  return invalid_response_error unless valid_comment?(comment)`

`  JudgmentResult.new(`
`    succeeded: true,`
`    error_code: nil,`
`    scores: scores.transform_keys(&:to_sym),`
`    comment: comment`
`  )`
`end`

**3.2 HTTPリクエスト実行メソッドの分離**

`# Gemini APIにHTTPリクエストを送信する`
`# @param post_content [String] 投稿本文`
`# @param persona [String] 審査員ID`
`# @return [Faraday::Response] HTTPレスポンス`
`def send_api_request(post_content, persona)`
`  request_body = build_request(post_content, persona)`
`  endpoint = "#{API_VERSION}/models/#{MODEL_NAME}:generateContent"`

`  client.post(endpoint) do |req|`
`    req.params[:key] = api_key`
`    req.headers['Content-Type'] = 'application/json'`
`    req.body = JSON.generate(request_body)`
`  end`
`end`

**3.3 ステータスコードハンドリングメソッドの分離**

`# ステータスコードに応じてレスポンスを処理する`
`# @param response [Faraday::Response] HTTPレスポンス`
`# @return [JudgmentResult] 審査結果`
`# @raise [Faraday::ClientError] クライアントエラー時`
`# @raise [Faraday::ServerError] サーバーエラー時`
`def handle_response_status(response)`
`  case response.status`
`  when 200..299`
`    Rails.logger.info('Gemini API呼び出し成功')`
`    parse_result = parse_response(response)`

`    # JudgmentResultが返された場合はそのまま返す（エラー時）`
`    return parse_result if parse_result.is_a?(JudgmentResult)`

`    # Hashが返された場合はバリデーションを実行してJudgmentResultを構築`
`    build_success_result(parse_result)`
`  when 429`
`    Rails.logger.warn("Gemini APIレート制限: #{response.body}")`
`    raise Faraday::ClientError.new('rate limit', faraday_response: response)`
`  when 400..499`
`    Rails.logger.error("Gemini APIクライアントエラー: #{response.status} - #{response.body}")`
`    raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)`
`  when 500..599`
`    Rails.logger.error("Gemini APIサーバーエラー: #{response.status} - #{response.body}")`
`    raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)`
`  else`
`    Rails.logger.error("Gemini API未知のエラー: #{response.status} - #{response.body}")`
`    raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)`
`  end`
`end`

**3.4 call_ai_apiの再構成**

`# 親クラスのcall_ai_apiをオーバーライドしてHTTP通信を実装`
`#`
`# @param post_content [String] 投稿本文`
`# @param persona [String] 審査員ID`
`# @return [JudgmentResult] 審査結果`
`def call_ai_api(post_content, persona)`
`  response = send_api_request(post_content, persona)`
`  handle_response_status(response)`
`rescue Faraday::TimeoutError => e`
`  Rails.logger.warn("Gemini APIタイムアウト: #{e.class}")`
`  raise`
`rescue Faraday::ConnectionFailed => e`
`  Rails.logger.error("Gemini API接続エラー: #{e.class}")`
`  raise`
`end`

**期待される効果**:
- `call_ai_api`が58行から20行程度に削減
- 各メソッドの責務が明確になる
- HTTP通信とレスポンス処理が分離され、テストがしやすくなる
- 200番台以外の成功ステータスコードにも対応
- サーバーエラーとクライアントエラーを区別

**検証方法**:

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb -e "#call_ai_api"`

---

### ステップ4: コメントの追加

**目的**: 複雑なロジックに日本語コメントを追加

**4.1 extract_json_from_codeblockの改善**

`# コードブロックからJSONを抽出する`
`#`
`# AIモデルがmarkdown形式のコードブロック（<code>```json ... ```</code>）で`
`# JSONを返す場合に、コードブロック記号を除去して純粋なJSONを抽出します。`
`#`
`# @example コードブロック付きのJSON`
`#   extract_json_from_codeblock('<code>```json</code>\n{"a":1}\n<code>```</code>') #=> '{"a":1}'`
`# @example 生のJSON`
`#   extract_json_from_codeblock('{"a":1}') #=> '{"a":1}'`
`#`
`# @param text [String] 生のテキスト`
`# @return [String] 抽出されたJSON文字列`
`def extract_json_from_codeblock(text)`
`  if text.include?('```')`
    `# <code>```json</code>` と <code>```</code>` の間のテキストを抽出`
`    # 正規表現の解説:`
`    # /<code>```json</code>\s*/  -> <code>```json</code>` とそれに続く空白をマッチ`
`    # /<code>```</code>\s*/      -> <code>```</code>` とそれに続く空白をマッチ`
`    text.gsub(/<code>```json</code>\s*/, '').gsub(/<code>```</code>\s*/, '').strip`
`  else`
`    text`
`  end`
`end`

**4.2 clientメソッドの改善**

`# Faraday HTTPクライアントを返す`
`#`
`# SSL証明書検証が有効化されています。`
`# タイムアウトは親クラスのBASE_TIMEOUT（30秒）を使用します。`
`#`
`# @return [Faraday::Connection] HTTPクライアント`
`def client`
`  @client ||= Faraday.new(url: BASE_URL) do |f|`
`    f.request :url_encoded`
`    f.options.timeout = BASE_TIMEOUT`
`    f.ssl.verify = true  # SSL証明書検証を有効化`
`    f.adapter Faraday.default_adapter`
`  end`
`end`

**4.3 build_requestメソッドの改善**

`# Gemini API用のリクエストを構築する`
`#`
`# プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。`
`# Gemini APIはgenerateContentエンドポイントを使用し、`
`# contents配列に会話のターンを含めます。`
`#`
`# @param post_content [String] 投稿本文`
`# @param persona [String] 審査員ID（現状はhiroyukiのみ対応）`
`# @return [Hash] APIリクエストボディ`
`def build_request(post_content, persona)`
`  # プロンプト内のプレースホルダーを置換`
`  prompt_text = @prompt.gsub('{post_content}', post_content)`

`  {`
`    contents: [`
`      {`
`        parts: [`
`          { text: prompt_text }`
`        ]`
`      }`
`    ],`
`    generationConfig: {`
`      temperature: 0.7,      # 創造性のバランス（0.0-1.0）`
`      maxOutputTokens: 1000  # 最大出力トークン数`
`    }`
`  }`
`end`

---

### ステップ5: 定数の整理

**目的**: マジックナンバーを定数として抽出

**実装**:

`class GeminiAdapter < BaseAiAdapter`
`  # プロンプトファイルのパス`
`  PROMPT_PATH = 'app/prompts/hiroyuki.txt'`

`  # Gemini APIのベースURL`
`  BASE_URL = 'https://generativelanguage.googleapis.com'.freeze`

`  # Gemini 2.0 Flash Experimentalモデル`
`  MODEL_NAME = 'gemini-2.0-flash-exp'.freeze`

`  # APIバージョン`
`  API_VERSION = 'v1beta'.freeze`

`  # レスポンスの最大長（コメント用）`
`  MAX_COMMENT_LENGTH = 30`

`  # 生成パラメータ`
`  TEMPERATURE = 0.7`
`  MAX_OUTPUT_TOKENS = 1000`

`  # エラーコード`
`  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'.freeze`

**適用**:
- `build_request`内の`0.7` → `TEMPERATURE`
- `build_request`内の`1000` → `MAX_OUTPUT_TOKENS`
- 各メソッド内の`'invalid_response'` → `ERROR_CODE_INVALID_RESPONSE`

---

## テスト検証計画

### 各ステップの検証

**ステップ1検証**:

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb`

期待: すべてのテストがパス

**ステップ2検証**:

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb -e "#parse_response"`

期待: `#parse_response`のすべてのテストがパス（43 examples）

**ステップ3検証**:

`cd backend && bundle exec rspec spec/adapters/gemini_adapter_spec.rb -e "#call_ai_api"`

期待: `#call_ai_api`のすべてのテストがパス（VCRカセット待ちのテストを除く）

**最終一括検証**:

すべてのステップ完了後に、以下のコマンドで最終確認を実施します。

`cd backend`

`# 1. テスト実行`
`bundle exec rspec spec/adapters/gemini_adapter_spec.rb --format documentation`

`# 2. カバレッジ確認（46.74%以上維持されていること）`
`COVERAGE=true bundle exec rspec spec/adapters/gemini_adapter_spec.rb`

`# 3. RuboCop確認`
`bundle exec rubocop app/adapters/gemini_adapter.rb`

期待: すべてのテストがパス

### カバレッジ確認

現在のカバレッジ（2025-02-11時点）:
- Line Coverage: 46.74% (208 / 445行)

`cd backend && COVERAGE=true bundle exec rspec spec/adapters/gemini_adapter_spec.rb`

期待: カバレッジがリファクタリング前の46.74%以上を維持

### RuboCop確認

`cd backend && bundle exec rubocop app/adapters/gemini_adapter.rb`

期待: 新しい警告が発生しない

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

---

## セキュリティ考慮事項

- APIキーはURLパラメータとして渡されますが、Faradayのデフォルト設定では
  リクエストボディ/パラメータはログされないため、ログ漏洩のリスクはありません
- SSL証明書検証が有効化されており、中間者攻撃に対する保護がされています

---

## 並行処理の考慮事項

- `@prompt_cache`へのアクセスは既に`@prompt_mutex`で保護されています
- 新しいprivateメソッド（`extract_text_from_response`等）はインスタンス変数を
  参照しないため、スレッドセーフです
- `call_ai_api`自体はスレッドセーフではありませんが、呼び出し元で適切に
  同期制御することを想定しています

---

## コミットメッセージ案

`refactor: E06-02 GeminiAdapterのリファクタリング #32`

`- invalid_response_errorメソッドを抽出して重複コードを削減`
`- parse_responseメソッドを3つの小さなメソッドに分割`
`  - extract_text_from_response: テキスト抽出`
`  - convert_scores_to_integers: スコア変換`
`  - extract_json_from_codeblock: JSON抽出`
`- call_ai_apiメソッドを4つの小さなメソッドに分割`
`  - send_api_request: HTTPリクエスト実行`
`  - handle_response_status: ステータスコード処理`
`  - build_success_result: 成功レスポンス構築`
`- 複雑なロジックに詳細コメントを追加`
`  - extract_json_from_codeblock: 正規表現の説明`
`  - build_request: Gemini API構造の説明`
`  - client: SSL設定の説明`
`- 定数を抽出（TEMPERATURE, MAX_OUTPUT_TOKENS等）`
`- ステータスコードハンドリングを改善（200番台、500番台に対応）`
`- スコア変換時のエラーハンドリングを強化`
`- 全体的なコード行数を282行から約240行に削減`

`Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

---

## 実装手順のまとめ

1. **ステップ1**: `invalid_response_error`メソッドの抽出
   - 5箇所の重複を1つのメソッドに集約
   - テスト実行して確認

2. **ステップ2**: `parse_response`の分割
   - `extract_text_from_response`の抽出
   - `convert_scores_to_integers`の抽出
   - `parse_response`の再構成
   - テスト実行して確認

3. **ステップ3**: `call_ai_api`の分割
   - `send_api_request`の抽出
   - `handle_response_status`の抽出
   - `build_success_result`の抽出
   - `call_ai_api`の再構成
   - テスト実行して確認

4. **ステップ4**: コメントの追加
   - 各メソッドに詳細な日本語コメントを追加
   - RuboCopで確認

5. **ステップ5**: 定数の整理
   - マジックナンバーを定数に置換
   - 最終テスト実行

6. **最終確認**: 全テスト + カバレッジ + RuboCop

---

## 関連ファイル

| ファイル | 目的 |
|---------|------|
| `backend/app/adapters/gemini_adapter.rb` | リファクタリングの主対象（282行→240行程度に削減） |
| `backend/app/adapters/base_ai_adapter.rb` | 親クラスの実装を確認し、重複を避けるために参照 |
| `backend/spec/adapters/gemini_adapter_spec.rb` | すべてのテストがパスすることを確認 |
| `backend/app/prompts/hiroyuki.txt` | プロンプトファイルの構造を理解するための参照 |

---

## リスク評価

| リスク | 影響 | 軽減策 |
|--------|------|--------|
| メソッド分割でバグを導入 | 高 | 各ステップでテスト実行、Green状態を維持 |
| 振る舞いが変わる | 高 | 既存テストですべてのパスを確認 |
| カバレッジが低下 | 中 | SimpleCovで前後比較（46.74%以上維持） |
| コードが複雑になる | 低 | メソッド数は増えるが、各メソッドは単純化 |
| 例外処理の漏れ | 中 | 各メソッドで適切な例外ハンドリングを実装 |
