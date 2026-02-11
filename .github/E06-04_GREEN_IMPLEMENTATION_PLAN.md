# E06-04 OpenAIAdapter TDD GREENフェーズ実装プラン

## コンテキスト

TDD REDフェーズが完了し、52件のテストが失敗状態（`NameError: uninitialized constant OpenAIAdapter`）になっています。GREENフェーズでは、最小限のコードでテストをパスさせます。

## 目的

- 46件のテストをパスする最小限のOpenAiAdapterを実装
- 過剰な最適化は避ける（Refactorフェーズで実施）
- エッジケースの追加実装はしない
- マジックナンバーを許容する

## 設計アプローチ

### GLMAdapterをベースにした実装

OpenAI APIとGLM APIは同じChat Completions形式を使用するため、GLMAdapterのコードをベースに5箇所を変更します。

**変更箇所:**

1. **クラス名とドキュメント**
   - `GlmAdapter` → `OpenAiAdapter`
   - コメント内の "GLM" → "OpenAI"

2. **定数の変更**
   - `PROMPT_PATH`: `'app/prompts/hiroyuki.txt'` → `'app/prompts/nakao.txt'`
   - `BASE_URL`: `'https://open.bigmodel.cn/api/paas/v4/'` → `'https://api.openai.com'`
   - `MODEL_NAME`: `'glm-4-flash'` → `'gpt-4o-mini'`

3. **エンドポイント**
   - `'chat/completions'` → `'v1/chat/completions'`（`v1`プレフィックスが必須）

4. **環境変数名**
   - `'GLM_API_KEY'` → `'OPENAI_API_KEY'`
   - エラーメッセージ内の `'GLM_API_KEYが設定されていません'` → `'OPENAI_API_KEYが設定されていません'`

5. **SSL設定の追加**（重要！）
   - GeminiAdapterと同様に `f.ssl.verify = true` を追加
   - テストでSSL証明書検証が必須とされている

## 実装の詳細

### 1. クラス構造

```ruby
# frozen_string_literal: true

# OpenAiAdapter - OpenAI GPT-4o-mini API用アダプター
#
# BaseAiAdapterを継承し、OpenAI API固有の実装を提供します。
# 中尾彬風の審査員として投稿を採点します。
#
# @see https://platform.openai.com/docs/api-reference/chat
class OpenAiAdapter < BaseAiAdapter
  # 定数定義（GLMAdapterから変更）
  PROMPT_PATH = 'app/prompts/nakao.txt'
  BASE_URL = 'https://api.openai.com'
  MODEL_NAME = 'gpt-4o-mini'

  # 共通定数（GLMAdapterと同じ）
  MAX_COMMENT_LENGTH = 30
  TEMPERATURE = 0.7
  MAX_TOKENS = 1000
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'

  # プロンプトキャッシュ（GLMAdapterと同じ）
  @prompt_cache = nil
  @prompt_mutex = Mutex.new

  class << self
    def prompt_cache
      @prompt_mutex.synchronize { @prompt_cache }
    end

    def prompt_cache=(value)
      @prompt_mutex.synchronize { @prompt_cache = value }
    end

    def reset_prompt_cache!
      @prompt_mutex.synchronize { @prompt_cache = nil }
    end
  end

  def initialize
    super
    @prompt = load_prompt
  end

  private

  # GLMAdapterからコピー（そのまま使用）
  def load_prompt
    cached = self.class.prompt_cache
    return cached if cached

    raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出' if PROMPT_PATH.include?('..') || PROMPT_PATH.start_with?('/')
    raise ArgumentError, "プロンプトファイルが見つかりません: #{PROMPT_PATH}" unless File.exist?(PROMPT_PATH)

    prompt = File.read(PROMPT_PATH)
    self.class.prompt_cache = prompt
    prompt
  end

  # GLMAdapterからSSL設定を追加
  def client
    @client ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json
      f.options.timeout = BASE_TIMEOUT
      f.ssl.verify = true  # SSL証明書検証を有効化（重要）
      f.adapter Faraday.default_adapter
    end
  end

  # GLMAdapterから環境変数名のみ変更
  def api_key
    # rubocop:disable Style/FetchEnvVar
    key = ENV['OPENAI_API_KEY']  # GLM_API_KEY → OPENAI_API_KEY
    # rubocop:enable Style/FetchEnvVar
    raise ArgumentError, 'OPENAI_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # GLMAdapterからそのままコピー
  def invalid_response_error
    JudgmentResult.new(succeeded: false, error_code: ERROR_CODE_INVALID_RESPONSE, scores: nil, comment: nil)
  end

  # GLMAdapterからそのままコピー（モデル名は自動的に定数を使用）
  def build_request(post_content, _persona)
    prompt_text = @prompt.gsub('{post_content}', post_content)

    {
      model: MODEL_NAME,
      messages: [
        { role: 'user', content: prompt_text }
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    }
  end

  # GLMAdapterからエンドポイントのみ変更
  def execute_request(request_body)
    response = client.post('v1/chat/completions') do |req|  # chat/completions → v1/chat/completions
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.body = request_body
    end

    handle_response_status(response)
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("OpenAI APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("OpenAI API接続エラー: #{e.class}")
    raise
  end

  # GLMAdapterからコメント内の"GLM" → "OpenAI"に変更
  def handle_response_status(response)
    case response.status
    when 200..299
      Rails.logger.info('OpenAI API呼び出し成功')
      response
    when 429
      Rails.logger.warn("OpenAI APIレート制限: #{response.body}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    when 400..499
      Rails.logger.error("OpenAI APIクライアントエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
    when 500..599
      Rails.logger.error("OpenAI APIサーバーエラー: #{response.status} - #{response.body}")
      raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
    else
      Rails.logger.error("OpenAI API未知のエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
    end
  end

  # GLMAdapterからそのままコピー
  def parse_response(response)
    body = response.body
    parsed = body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body

    content = parsed.dig(:choices, 0, :message, :content)
    unless content
      Rails.logger.error('OpenAI APIレスポンスにcontentが含まれていません')
      return invalid_response_error
    end

    json_text = extract_json_from_codeblock(content)

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

    {
      scores: scores,
      comment: comment
    }
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    invalid_response_error
  end

  # GLMAdapterからそのままコピー
  def extract_json_from_codeblock(text)
    if text.include?('```')
      if text.match?(/```json/)
        extracted = text.slice(/```json\s*\n(.*?)\n```/m, 1)
        return extracted.strip if extracted
      end

      extracted = text.slice(/```\s*\n(.*?)\n```/m, 1)
      return extracted.strip if extracted
    end
    text
  end

  # GLMAdapterからそのままコピー
  def convert_scores_to_integers(data)
    scores = {}
    REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]
      raise ArgumentError, "Score value is nil for #{key}" if value.nil?

      begin
        integer_value = if value.is_a?(Integer)
                          value
                        else
                          Float(value).round
                        end
      rescue ArgumentError, FloatDomainError, RangeError, TypeError => e
        raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}", cause: e
      end
      scores[key] = integer_value
    end
    scores
  end

  # GLMAdapterからそのままコピー
  def truncate_comment(comment)
    return nil if comment.nil?

    comment.to_s.strip[0...MAX_COMMENT_LENGTH]
  end
end
```

### 2. 重要なポイント

**SSL証明書検証（必須）:**
```ruby
f.ssl.verify = true
```
テストで `expect(client.ssl.verify).to be true` が検証されるため必須です。

**Authorizationヘッダー（必須）:**
```ruby
req.headers['Authorization'] = "Bearer #{api_key}"
```
テストで `expect(client.headers['Authorization']).to eq('Bearer test_api_key_12345')` が検証されるため必須です。

**エンドポイント（必須）:**
```ruby
client.post('v1/chat/completions')
```
`v1` プレフィックスが必須です（OpenAI APIの仕様）。

**スコア変換:**
```ruby
Float(value).round
```
文字列や浮動小数点数を整数に変換します。テストで文字列 `"15"` や浮動小数点数 `15.0` のケースが検証されます。

**コメント切り詰め:**
```ruby
comment.to_s.strip[0...MAX_COMMENT_LENGTH]
```
30文字で切り詰めます。テストで35文字のケースが検証されます。

**BASE_TIMEOUT（親クラスから継承）:**
```ruby
f.options.timeout = BASE_TIMEOUT  # 30秒（BaseAiAdapter::BASE_TIMEOUT）
```
`BaseAiAdapter::BASE_TIMEOUT = 30` を使用します。

## 実装手順

1. **ファイル作成**
   - `backend/app/adapters/open_ai_adapter.rb` を作成
   - GLMAdapterの内容をコピー

2. **変更適用**
   - クラス名を `OpenAiAdapter` に変更
   - 定数を変更（PROMPT_PATH, BASE_URL, MODEL_NAME）
   - 環境変数名を `'OPENAI_API_KEY'` に変更
   - エンドポイントを `'v1/chat/completions'` に変更
   - ログメッセージ内の "GLM" を "OpenAI" に変更
   - SSL設定 `f.ssl.verify = true` を追加

3. **RuboCopチェック**
   - `bundle exec rubocop app/adapters/open_ai_adapter.rb -A`
   - 自動修正を適用

4. **テスト実行**
   - `bundle exec rspec spec/adapters/openai_adapter_spec.rb --format documentation`
   - 46件のテストがパスすることを確認

5. **コミット**
   - 実装をコミット（Issue番号 #34 を含める）
   - コミットメッセージ例:
     ```
     feat: E06-04 OpenAiAdapterの最小限実装を追加（GREENフェーズ） #34

     - backend/app/adapters/open_ai_adapter.rbを作成
     - GLMAdapterをベースに5箇所を変更
     - 46件のテストがすべてパス
     - SSL証明書検証を有効化
     - OpenAI GPT-4o-mini API対応

     Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
     ```

## 検証方法

```bash
# テスト実行（46件がパスすることを期待）
cd backend
bundle exec rspec spec/adapters/openai_adapter_spec.rb --format documentation

# カバレッジ確認
COVERAGE=true bundle exec rspec spec/adapters/openai_adapter_spec.rb

# RuboCop
bundle exec rubocop app/adapters/open_ai_adapter.rb

# セキュリティスキャン
bundle exec brakeman -q
```

## テストケース一覧（46件）

### 正常系（12件）
1. BaseAiAdapterを継承していること
2. PROMPT_PATH定数が定義されていること
3. PROMPT_PATH定数が正しいパスを返すこと
4. BASE_URL定数が定義されていること
5. MODEL_NAME定数がgpt-4o-miniであること
6. プロンプトファイルを読み込むこと
7. プロンプトに{post_content}プレースホルダーが含まれること
8. プロンプトファイルがキャッシュされること
9. Faraday::Connectionインスタンスを返すこと
10. OpenAI APIのベースURLが設定されていること
11. SSL証明書の検証が有効であること
12. タイムアウトが30秒に設定されていること

### リクエスト構築（9件）
13. 正しいリクエスト形式であること
14. プロンプトが{post_content}に置換されていること
15. modelがgpt-4o-miniに設定されていること
16. temperatureが0.7に設定されていること
17. max_tokensが1000に設定されていること
18. post_contentにJSON制御文字が含まれる場合に正しくエスケープされること
19. post_contentに特殊文字が含まれる場合に正しく扱うこと
20. post_contentに改行が含まれる場合に正しく扱うこと
21. post_contentに絵文字が含まれる場合に正しく扱うこと

### レスポンス解析（16件）
22. スコアとコメントが正しく解析されること
23. スコアが文字列の場合に整数に変換できること
24. スコアが浮動小数点数の場合に整数に変換できること
25. スコアが0の場合は有効と判定されること
26. スコアが20の場合は有効と判定されること
27. JSONがコードブロックで囲まれている場合に正しく解析できること
28. JSONがmarkdownのコードブロックで囲まれている場合に解析できること
29. JSONが不正な場合はinvalid_responseエラーコードを返すこと
30. スコアが欠落している場合はinvalid_responseエラーコードを返すこと
31. choicesが空の場合はinvalid_responseエラーコードを返すこと
32. choicesがnilの場合はinvalid_responseエラーコードを返すこと
33. スコアが-1の場合は親クラスのバリデーションで検証されること
34. スコアが21の場合は親クラスのバリデーションで検証されること
35. commentが30文字を超える場合はtruncateされること
36. commentがちょうど30文字の場合はtruncateされないこと

### APIキー（4件）
37. ENV["OPENAI_API_KEY"]を返すこと
38. APIキーがnilの場合は例外を発生させること
39. APIキーが空文字列の場合は例外を発生させること
40. APIキーが空白のみの場合は例外を発生させること

### プロンプトファイル（1件）
41. プロンプトファイルが存在しない場合は例外を発生させること

### プロンプトキャッシュ（1件）
42. プロンプトファイルのキャッシュが正しく動作すること

**注記**: 42件のOpenAiAdapterテストに加え、FactoryBotのテスト（4件）が含まれるため、合計46件のテストが実行されます。

## 完了基準

- [ ] `backend/app/adapters/open_ai_adapter.rb` が作成されている
- [ ] 46件のテストがすべてパスしている
- [ ] RuboCopのエラーがない（クラス長・メソッド長は許容）
- [ ] Brakemanのセキュリティ警告がない
- [ ] コミットメッセージにIssue番号 #34 が含まれている

## 注意事項

### セキュリティ
- APIキーをログに出力しない（現在の実装では出力していない）
- `response.body` をログ出力する際、機密情報が含まれていないか注意（現在の実装ではOpenAI APIのエラーレスポンスのみ）

### 次のフェーズ（Refactor）
GREENフェーズ完了後に以下の最適化を実施：
- ユーティリティメソッドの共通化（GeminiAdapter、GLMAdapter、OpenAIAdapter間）
- コードのDRY原則の適用
- テストのリファクタリング

### VCRカセット作成（次のフェーズ）
Integration Test用のVCRカセットは、GREENフェーズ完了後に作成：
- `spec/fixtures/vcr_cassettes/openai_adapter/success.yml`
- `spec/fixtures/vcr_cassettes/openai_adapter/timeout.yml`
- `spec/fixtures/vcr_cassettes/openai_adapter/rate_limit.yml`
- その他必要なシナリオ

## レビュー指摘事項

### [重要度: 高] なし
このプランはGREENフェーズ（最小限の実装）に焦点を当てているため、重要な指摘事項はありません。

### [重要度: 中] BASE_TIMEOUTの明記

**問題点:**
`BASE_TIMEOUT`の値がプランに明記されていない。BaseAiAdapterから継承するが、実装時に参照しやすいよう明記すべき。

**改善提案:**
```
BASE_TIMEOUT（親クラスから継承）:
```ruby
f.options.timeout = BASE_TIMEOUT  # 30秒（BaseAiAdapter::BASE_TIMEOUT）
```
`BaseAiAdapter::BASE_TIMEOUT = 30` を使用します。
```

### [重要度: 中] テストケース一覧の追加

**問題点:**
「52件のテスト」と言及しているが、どのテストが含まれるか明記されていない。実装時の網羅性確認のため、テストケース一覧を追加すべき。

**改善提案:**
「テストケース一覧（52件）」セクションを追加し、各テストケースをリスト化。

### [重要度: 低] コミットメッセージ例の追加

**問題点:**
コミットメッセージの例が記載されていない。CLAUDE.mdのルールに従った具体的なメッセージ例があると良い。

**改善提案:**
「コミット」セクションにコミットメッセージ例を追加。

## 次のステップ

GREENフェーズ完了後：
1. 46件のテストがパスしたことを確認
2. コミット完了後、ユーザーに報告
3. 次のフェーズ（Refactor）の指示を待つ
4. VCRカセット作成（Integration Test用）
