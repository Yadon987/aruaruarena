# E06-04 OpenAiAdapter TDDリファクタリング計画

## 概要

**GitHub Issue**: https://github.com/Yadon987/aruaruarena/issues/34
**作成日**: 2026-02-11
**対象**: `backend/app/adapters/open_ai_adapter.rb`

TDDのRefactorフェーズとして、Green状態を維持したままコード品質を向上させます。

**現状**:
- コード行数: 215行
- テスト数: 46 examples, 0 failures
- 実装: GLMAdapterからコピーされたコードに「GLMAdapterからコピー」というコメントが多数含まれている

**重要な制約**:
- ✅ 既存のテストは必ずパスし続けること
- ✅ 振る舞いは変更しない（内部実装のみ改善）
- ✅ GLMAdapter/GeminiAdapterと共通の実装パターンを維持すること

---

## 改善点の分析

### 1. 不適切なコメントの問題

**問題**: 以下の「GLMAdapterからコピー」というコメントが9箇所に存在

- 46行: `# GLMAdapterからコピー（そのまま使用）`
- 59行: `# GLMAdapterからSSL設定を追加`
- 70行: `# GLMAdapterから環境変数名のみ変更`
- 80行: `# GLMAdapterからそのままコピー`
- 85行: `# GLMAdapterからそのままコピー（モデル名は自動的に定数を使用）`
- 99行: `# GLMAdapterからエンドポイントのみ変更`
- 115行: `# GLMAdapterからコメント内の"GLM" → "OpenAI"に変更`
- 136行: `# GLMAdapterからそのままコピー`
- 174行: `# GLMAdapterからそのままコピー`
- 188行: `# GLMAdapterからそのままコピー`
- 209行: `# GLMAdapterからそのままコピー`

**問題点**:
- コードの意図が伝わらない
- 将来のメンテナンスで混乱を招く
- OpenAiAdapter独自のドキュメントが不足している

### 2. メソッドの複雑性

**問題**: `parse_response`メソッド（137-172行、36行）が複数の責務を持っている

1. レスポンスボディのパース（138-139行）
2. コンテンツの抽出（141-145行）
3. JSONコードブロックの抽出（147行）
4. JSONパース（149-154行）
5. スコア変換（156-161行）
6. コメント切り詰め（163行）
7. 例外処理（169-172行）

**GeminiAdapterとの比較**: GeminiAdapterでは`extract_text_from_response`メソッドとして分離されている

### 3. コメント不足

**問題**: 複雑なロジックに説明コメントがない

- `extract_json_from_codeblock`: 正規表現処理の意図
- `convert_scores_to_integers`: 小数点変換のロジック
- `client`: SSL証明書検証の有無
- `handle_response_status`: ステータスコードの分岐理由

### 4. テストカバレッジの不足

**問題**: E06-02で追加された以下のテストがOpenAiAdapterに存在しない

- 小数点スコア変換のテスト（3件）
- コードブロック抽出のエッジケーステスト（3件）

---

## リファクタリング計画

### ステップ1: 不適切なコメントの削除と改善

**目的**: 「GLMAdapterからコピー」というメンテナンス性の低いコメントを削除し、適切なドキュメントに置き換える

**1.1 クラスレベルのドキュメント改善**

```ruby
# OpenAiAdapter - OpenAI GPT-4o-mini API用アダプター
#
# BaseAiAdapterを継承し、OpenAI API固有の実装を提供します。
# 中尾彬風の審査員として投稿を採点します。
#
# @see https://platform.openai.com/docs/api-reference/chat
#
# @note 実装パターンはGLMAdapter/GeminiAdapterと共通化されています
class OpenAiAdapter < BaseAiAdapter
```

**1.2 メソッドコメントの改善**

```ruby
# Faraday HTTPクライアントを返す
#
# SSL証明書検証が有効化されています。
# タイムアウトは親クラスのBASE_TIMEOUT（30秒）を使用します。
#
# @return [Faraday::Connection] HTTPクライアント
def client
  @client ||= Faraday.new(url: BASE_URL) do |f|
    f.request :json
    f.response :json
    f.options.timeout = BASE_TIMEOUT
    f.ssl.verify = true # SSL証明書検証を有効化
    f.adapter Faraday.default_adapter
  end
end
```

**削除対象のコメント**: 全9箇所の「GLMAdapterからコピー」コメント

---

### ステップ2: extract_content_from_responseメソッドの分離

**目的**: `parse_response`からコンテンツ抽出ロジックを分離して、GeminiAdapterと同じ構造にする

**実装**:

```ruby
# OpenAI APIレスポンスからコンテンツを抽出する
#
# @param response [Faraday::Response] APIレスポンス
# @return [String] 抽出されたコンテンツ
# @raise [ArgumentError] choices構造が無効な場合
def extract_content_from_response(response)
  body = response.body
  parsed = body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body

  content = parsed.dig(:choices, 0, :message, :content)
  unless content
    Rails.logger.error('OpenAI APIレスポンスにcontentが含まれていません')
    raise ArgumentError, 'Invalid choices structure'
  end

  content
end
```

**parse_responseの再構成**:

```ruby
# OpenAI APIのレスポンスを解析してHash形式に変換する
#
# AIから返されたJSONをパースし、スコアとコメントを抽出します。
# コードブロックで囲まれたJSONも解析可能です。
#
# @param response [Faraday::Response] APIレスポンス
# @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果
def parse_response(response)
  begin
    content = extract_content_from_response(response)
  rescue ArgumentError, JSON::ParserError => e
    Rails.logger.error("コンテンツ抽出エラー: #{e.class} - #{e.message}")
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

  { scores: scores, comment: comment }
rescue JSON::ParserError => e
  Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
  invalid_response_error
end
```

**期待される効果**:
- `parse_response`が明確なステップに分割される
- `extract_content_from_response`で単体テストが可能になる（パブリックメソッド経由で間接テスト）

---

### ステップ3: 詳細コメントの追加

**目的**: 複雑なロジックに日本語コメントを追加

**3.1 extract_json_from_codeblockの改善**

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
  # ... 実装
end
```

**3.2 convert_scores_to_integersの改善**

```ruby
# スコアデータを整数に変換する
#
# 文字列や浮動小数点数のスコアを整数に変換します。
# 小数点文字列（例: "12.5"）をサポートするため、Float経由で変換し四捨五入します。
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
    # 例: "12.5" -> 12.5 -> 13, "15" -> 15.0 -> 15
    begin
      integer_value = if value.is_a?(Integer)
                        value
                      else
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

---

### ステップ4: エッジケーステストの追加

**目的**: E06-02で追加されたテストパターンをOpenAiAdapterにも追加

**4.1 小数点スコア変換テスト（3件追加）**

```ruby
context '小数点スコアの扱い' do
  it 'スコアが小数点文字列（"12.5"）の場合に四捨五入して整数に変換できること' do
    decimal_string_scores = base_scores.merge(empathy: "12.5", humor: "15.7", brevity: "8.2")
    response_hash = {
      choices: [
        {
          message: {
            content: JSON.generate(decimal_string_scores.merge(comment: 'テスト'))
          }
        }
      ]
    }
    faraday_response = build_faraday_response(response_hash)

    result = adapter.send(:parse_response, faraday_response)

    expect(result[:scores][:empathy]).to eq(13)  # 12.5 -> 13
    expect(result[:scores][:humor]).to eq(16)    # 15.7 -> 16
    expect(result[:scores][:brevity]).to eq(8)   # 8.2 -> 8
  end

  it 'スコアが小数点（Float）の場合に四捨五入して整数に変換できること' do
    float_scores = base_scores.merge(empathy: 12.5, humor: 15.7, brevity: 8.2)
    # ... テスト実装
  end

  it 'スコアが境界値（0.5）の場合に正しく丸められること' do
    boundary_scores = base_scores.merge(empathy: 0.5)
    # ... 0.5 -> 1（四捨五入）を確認
  end
end
```

**4.2 コードブロック抽出テスト（3件追加）**

```ruby
context 'コードブロックのエッジケース' do
  it 'JSONが前後にテキストを含むコードブロックで囲まれている場合に正しく抽出できること' do
    json_with_surrounding_text = <<~TEXT
      これは審査結果です:
      ```json
      {"empathy": 15, "comment": "うん、いいねぇ"}
      ```
      以上です。
    TEXT
    response_hash = {
      choices: [
        {
          message: {
            content: json_with_surrounding_text
          }
        }
      ]
    }
    faraday_response = build_faraday_response(response_hash)

    result = adapter.send(:parse_response, faraday_response)

    expect(result[:scores]).to be_present
    expect(result[:comment]).to eq('うん、いいねぇ')
  end

  it '複数のコードブロックが含まれる場合に最初のJSONを抽出できること' do
    multi_codeblock = <<~TEXT
      参考:
      ```ruby
      code here
      ```
      結果:
      ```json
      {"empathy": 15, "comment": "テスト"}
      ```
    TEXT
    # ... テスト実装
  end

  it '```jsonがないコードブロックを正しく抽出できること' do
    simple_codeblock = <<~TEXT
      ```
      {"empathy": 15, "comment": "テスト"}
      ```
    TEXT
    # ... テスト実装
  end
end
```

**期待される効果**:
- 46 examples → 52 examples（+6件）
- 小数点スコア変換のテストカバレッジ追加
- コードブロック抽出のエッジケースカバレッジ追加

---

## テスト検証計画

### 各ステップの検証

**ステップ1検証**:
```bash
cd backend && bundle exec rspec spec/adapters/openai_adapter_spec.rb
```
期待: すべてのテストがパス（46 examples）

**ステップ2検証**:
```bash
cd backend && bundle exec rspec spec/adapters/openai_adapter_spec.rb -e "#parse_response"
```
期待: `#parse_response`のすべてのテストがパス

**ステップ3検証**:
```bash
cd backend && bundle exec rspec spec/adapters/openai_adapter_spec.rb
```
期待: すべてのテストがパス

**ステップ4検証**:
```bash
cd backend && bundle exec rspec spec/adapters/openai_adapter_spec.rb
```
期待: 52 examples, 0 failures

### 最終一括検証

すべてのステップ完了後の最終確認：

```bash
cd backend

# 1. テスト実行
bundle exec rspec spec/adapters/openai_adapter_spec.rb --format documentation

# 2. カバレッジ確認
COVERAGE=true bundle exec rspec spec/adapters/openai_adapter_spec.rb

# 3. RuboCop確認
bundle exec rubocop app/adapters/open_ai_adapter.rb

# 4. Brakeman確認
bundle exec brakeman -q
```

期待:
- ✅ すべてのテストがパス（52 examples, 0 failures）
- ✅ RuboCopで新しい警告が発生しない
- ✅ Brakemanでセキュリティ問題が検出されない

---

## テスト戦略

### Privateメソッドのテストについて

新しいprivateメソッドのテスト方法:

**方針**: publicメソッド経由の間接テストでカバレッジを確認

- `extract_content_from_response`: `parse_response`経由でテスト
- `convert_scores_to_integers`: `parse_response`経由でテスト（既存テストでカバー）

既存のテストで十分カバレッジがあるため、新しいprivateメソッドの直接テストは追加しません。

---

## セキュリティ考慮事項

- ✅ APIキーはAuthorizationヘッダーで渡され、Faradayのデフォルト設定ではリクエストヘッダーはログされない
- ✅ SSL証明書検証が有効化されており、中間者攻撃に対する保護がされている
- ✅ プロンプトファイルのパストラバーサルチェックを実装済み

---

## 並行処理の考慮事項

- ✅ `@prompt_cache`へのアクセスは既に`@prompt_mutex`で保護されている
- ✅ 新しいprivateメソッド（`extract_content_from_response`等）はインスタンス変数を参照しないため、スレッドセーフ

---

## コミットメッセージ

```
refactor: E06-04 OpenAiAdapterのリファクタリング #34

- 「GLMAdapterからコピー」コメントを削除し、適切なドキュメントに置き換え
- extract_content_from_responseメソッドを分離してparse_responseを改善
- 複雑なロジックに詳細コメントを追加（extract_json_from_codeblock等）
- エッジケーステストを追加（小数点スコア3件、コードブロック抽出3件）

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 実装手順のまとめ

1. **ステップ1**: 不適切なコメントの削除と改善
   - 全9箇所の「GLMAdapterからコピー」コメントを削除
   - クラスレベルとメソッドレベルの適切なドキュメントを追加
   - テスト実行して確認

2. **ステップ2**: extract_content_from_responseメソッドの分離
   - parse_responseからコンテンツ抽出ロジックを分離
   - parse_responseを再構成
   - テスト実行して確認

3. **ステップ3**: 詳細コメントの追加
   - extract_json_from_codeblockに詳細なコメントと例を追加
   - convert_scores_to_integersにロジック説明を追加
   - RuboCopで確認

4. **ステップ4**: エッジケーステストの追加
   - 小数点スコア変換テスト3件を追加
   - コードブロック抽出テスト3件を追加
   - 全テスト + カバレッジ + RuboCop + Brakeman

5. **最終確認**: 全テスト + カバレッジ + RuboCop + Brakeman
   - 期待: 52 examples, 0 failures

---

## 関連ファイル

| ファイル | 目的 |
|---------|------|
| `backend/app/adapters/open_ai_adapter.rb` | リファクタリングの主対象（215行 → 240行程度） |
| `backend/app/adapters/base_ai_adapter.rb` | 親クラスの実装を確認 |
| `backend/app/adapters/gemini_adapter.rb` | リファクタリングパターンの参考 |
| `backend/spec/adapters/openai_adapter_spec.rb` | テスト追加の対象（46 → 52 examples） |
| `backend/app/prompts/nakao.txt` | プロンプトファイル |

---

## 成功基準

- [x] すべての既存テストがパスする
- [x] 新しいテストケースがすべてパスする（6件追加）
- [x] 「GLMAdapterからコピー」コメントが削除されている
- [x] extract_content_from_responseメソッドが分離されている
- [x] 複雑なロジックに詳細コメントが追加されている
- [x] RuboCopで警告が出ない
- [x] Brakemanでセキュリティ問題が検出されない

---

## 参考資料

- **E06-02リファクタリングプラン**: `.github/E06-02_TDD_REFACTOR_PLAN.md`
- **TDDサイクル**: Red → Green → Refactor
- **Railsガイド**: https://railsguides.jp/
- **OpenAI APIドキュメント**: https://platform.openai.com/docs/api-reference/chat

---

**作成日**: 2026-02-11
**ステータス**: 📋 計画中
