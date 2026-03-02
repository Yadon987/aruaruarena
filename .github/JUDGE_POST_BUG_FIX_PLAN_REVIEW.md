# 本番環境 審査全失敗問題の修正プラン

## 問題概要

本番環境で投稿後の審査が **全3審査員 (デヴィ婦人風/ひろゆき風/中尾彬風) で失敗** している。
スクリーンショットでは全スコアが空欄、全て「失敗」と表示されている。

---

## 根本原因分析

### 🔴 原因1（確定）: APIレスポンスのフィールド名ミスマッチ

バックエンドの `Judgment#to_judgment_json` が `succeeded` キーで返すが、フロントエンドの `Judgment` 型は `success` キーを期待している。

**影響ファイル:**
- `backend/app/models/judgment.rb` (L158-162)
- `frontend/src/shared/types/domain.ts` (L32-42)

```ruby
# 現在の to_judgment_json 出力:
{ persona: "hiroyuki", succeeded: true, empathy: 15, ... }

# フロントエンド Judgment 型の期待:
{ persona: "hiroyuki", success: true, empathy: 15, ... }
```

**影響範囲:**
- `judgment.success` が常に `undefined` (falsy) → 全判定が「失敗」表示
- 再審査ボタンの `!j.success` フィルタリング (`ResultModal.tsx:L112`) も誤動作
- `JudgeResultCard.tsx:L26` の成功/失敗表示も誤動作

### 🟡 原因2（要調査）: バックエンド審査のAI API呼び出し失敗

スコアが全て空欄であることは、DBに `succeeded=false` で保存されたことを意味する。
つまり、**フィールド名ミスマッチの前段階で、AIからの審査自体が全て失敗している** 可能性が高い。

考えられる原因:
- Lambda環境変数に `GLM_API_KEY` が設定されていない（`lambda.tf` で `CEREBRAS_API_KEY` で代替されている）
- 各AI APIのレート制限やサービスエラー
- `JsonParserConcern#parse_json_payload` でAIレスポンスの解析が失敗
- Lambda タイムアウト（120秒設定 vs 並列審査70秒×3 = 実質的に70秒以内に収まるはず）

> [!IMPORTANT]
> **原因2の確定にはCloudWatch Logsの確認が必要です**。本番Lambdaのログに `[JudgePostService] 審査失敗` や `Exception in thread` のエラーログが残っているはずです。

---

## レビュー指摘事項と対応

### レビュー指摘1: [重要度: 高] error_code型の不一致

**問題点:**
計画書では `error_code` を出力しているが、フロントエンドの `Judgment` 型に `error_code` プロパティが存在しない。

**現状確認:**
- `to_judgment_json` は `error_code: error_code` を出力
- `frontend/src/shared/types/domain.ts` の `Judgment` 型には `error_code` が未定義

**改善提案:**
フロントエンドの型定義に `error_code?: string | null` を追加するか、バックエンドで `error_code` を出力しないか決定が必要。現在の仕様ではエラー詳細をユーザーに表示しないため、型定義への追加を推奨。

### レビュー指摘2: [重要度: 高] 修正案の選択理由が不明確

**問題点:**
計画書では「バックエンドで `success` に変更」を提案しているが、選択理由が記載されていない。

**改善提案:**
以下の比較に基づき、**バックエンドでの修正（A案）を採用**:

| 観点 | A案: バックエンド修正 | B案: フロントエンド修正 |
|------|----------------------|------------------------|
| 変更範囲 | 1ファイル (judgment.rb) | 2ファイル以上 (domain.ts, ResultModal.tsx, JudgeResultCard.tsx) |
| テスト影響 | 既存テストの更新が最小 | 複数コンポーネントのテスト更新が必要 |
| API互換性 | Breaking Change (Cache-Control考慮済み) | 影響なし |
| 意味論的整合性 | `succeeded` (形容詞) → `success` (名詞) へ変換 | `succeeded` をそのまま使用 |

**選択理由:**
- 変更箇所が最小で、デバッグ容易性が高い
- APIのキャッシュ期間（1時間）は計画書で言及済み
- フロントエンドの `success` は一般的なAPI命名規則に準拠

### レビュー指摘3: [重要度: 中] テスト追加の詳細が不足

**問題点:**
「テストを追加/修正」とあるが、具体的なテストケースが不明確。

**改善提案:**
以下のテストケースを明示的に追加:

```ruby
# spec/models/judgment_spec.rb
describe '#to_judgment_json' do
  context '成功した審査の場合' do
    it 'success キーに true を設定する' do
      judgment = build(:judgment, succeeded: true)
      json = judgment.to_judgment_json
      expect(json[:success]).to be true
    end
  end

  context '失敗した審査の場合' do
    it 'success キーに false を設定する' do
      judgment = build(:judgment, succeeded: false, error_code: 'timeout')
      json = judgment.to_judgment_json
      expect(json[:success]).to be false
      expect(json[:error_code]).to eq 'timeout'
    end
  end

  it 'succeeded キーを含まない（後方互換性のため削除）' do
    judgment = build(:judgment, succeeded: true)
    json = judgment.to_judgment_json
    expect(json).not_to have_key(:succeeded)
  end
end
```

### レビュー指摘4: [重要度: 中] 並行処理のエラーハンドリング検証不足

**問題点:**
`JudgePostService` は3つのアダプターを並列実行するが、スレッド例外時の挙動が検証されていない。

**現状確認:**
- `handle_thread_error` メソッドで例外を捕捉
- `Thread.abort_on_exception = false` でスレッド例外を握り潰す可能性

**改善提案:**
- `process_single_judge` の `rescue StandardError => e` が全ての例外を捕捉することを確認
- テストでスレッド内例外時の挙動を検証するケースを追加

### レビュー指摘5: [重要度: 中] デバッグログの追加情報

**問題点:**
`adapter=#{adapter_class.name}` の追加のみで、エラー原因特定に十分でない可能性。

**改善提案:**
以下のログも追加:

```ruby
rescue StandardError => e
  Rails.logger.error("[JudgePostService] 例外発生: persona=#{persona}, " \
    "adapter=#{adapter_class.name}, error_class=#{e.class}, message=#{e.message}")
  handle_thread_error(persona, e)
end
```

### レビュー指摘6: [重要度: 低] フロントエンド型定義の optional プロパティ

**問題点:**
`Judgment` 型の `success` が必須 (`boolean`) だが、APIレスポンスが不正な場合 `undefined` になる可能性。

**改善提案:**
型定義を `success?: boolean` とし、コンポーネント側でデフォルト値 (`false`) を設定:

```typescript
// domain.ts
export interface Judgment {
  // ...
  success?: boolean  // optional に変更
}

// JudgeResultCard.tsx
<p className="mt-1 text-sm">{judgment.success ?? false ? '成功' : '失敗'}</p>
```

### レビュー指摘7: [重要度: 低] CloudWatch Logs検索パターンの拡充

**問題点:**
検索パターンが限定的で、全てのエラーケースを網羅していない。

**改善提案:**
以下のパターンも追加:
- `Net::ReadTimeout`
- `Faraday::Error`
- `JSON::ParserError`
- `Aws::DynamoDB::Errors`

---

## Proposed Changes

### バックエンド: フィールド名修正

#### [MODIFY] `backend/app/models/judgment.rb`

`to_judgment_json` メソッドでフロントエンドが期待する `success` キーを使用するように修正:

```diff
  def to_judgment_json
-   base = { persona: persona, succeeded: succeeded }
+   base = { persona: persona, success: succeeded }
    scores = SCORE_FIELDS.index_with { |field| send(field) }
    base.merge(scores).merge(total_score: total_score, comment: comment, error_code: error_code)
  end
```

---

### バックエンド: デバッグ強化（原因2の特定用）

#### [MODIFY] `backend/app/services/judge_post_service.rb`

`process_single_judge` でレスポンスの `error_code` を詳細にログ出力:

```diff
  def process_single_judge(persona, adapter_class)
    Rails.logger.info("[JudgePostService] 審査開始: persona=#{persona}")

    adapter = adapter_class.new
    result = adapter.judge(@post.body, persona: persona)

    if result.succeeded
      Rails.logger.info("[JudgePostService] 審査成功: persona=#{persona}")
    else
-     Rails.logger.warn("[JudgePostService] 審査失敗: persona=#{persona}, error_code=#{result.error_code}")
+     Rails.logger.warn("[JudgePostService] 審査失敗: persona=#{persona}, " \
+       "error_code=#{result.error_code}, adapter=#{adapter_class.name}")
    end

    { persona: persona, result: result }
  rescue StandardError => e
+   Rails.logger.error("[JudgePostService] 例外発生: persona=#{persona}, " \
+     "adapter=#{adapter_class.name}, error_class=#{e.class}, message=#{e.message}")
    handle_thread_error(persona, e)
  end
```

---

### テスト追加

#### [ADD/MODIFY] `backend/spec/models/judgment_spec.rb`

```ruby
describe '#to_judgment_json' do
  let(:judgment) { build(:judgment, persona: 'hiroyuki', succeeded: true) }

  it 'success キーを含む' do
    expect(judgment.to_judgment_json[:success]).to be true
  end

  it 'succeeded キーを含まない' do
    expect(judgment.to_judgment_json).not_to have_key(:succeeded)
  end

  context 'succeeded=false の場合' do
    let(:judgment) { build(:judgment, succeeded: false, error_code: 'timeout') }

    it 'success キーに false を設定する' do
      expect(judgment.to_judgment_json[:success]).to be false
    end

    it 'error_code を含む' do
      expect(judgment.to_judgment_json[:error_code]).to eq 'timeout'
    end
  end
end
```

---

### フロントエンド: 型定義の改善（オプション）

#### [MODIFY] `frontend/src/shared/types/domain.ts`

```diff
 export interface Judgment {
   persona: JudgePersona
   total_score: number
   empathy: number
   humor: number
   brevity: number
   originality: number
   expression: number
   comment: string
-  success: boolean
+  success?: boolean
+  error_code?: string | null
 }
```

---

## User Review Required

> [!IMPORTANT]
> **CloudWatch Logsの確認をお願いします**。以下のログパターンを検索してください:
>
> ```
> [JudgePostService] 審査失敗
> [JudgePostService] 例外発生
> [JudgePostService] Exception in thread
> 審査失敗
> JSONパースエラー
> JSON::ParserError
> Net::ReadTimeout
> Faraday::Error
> Aws::DynamoDB::Errors
> ```

> [!WARNING]
> `to_judgment_json` のフィールド名変更は **API Breaking Change** です。既にキャッシュされた古いレスポンスがCDN等にある場合、一定期間はミスマッチが生じます。`Cache-Control` ヘッダーは `max-age=3600` で1時間キャッシュのため、デプロイ後1時間で解消します。

---

## Verification Plan

### 自動テスト

```bash
cd backend
# 1. Judgment モデルテスト
bundle exec rspec spec/models/judgment_spec.rb

# 2. JudgePostService テスト
bundle exec rspec spec/services/judge_post_service_spec.rb

# 3. PostsController テスト（API応答の検証）
bundle exec rspec spec/requests/api/posts_spec.rb

# 4. 全テスト実行
bundle exec rspec

# 5. Lint
bundle exec rubocop -A

# 6. セキュリティスキャン
bundle exec brakeman -q
```

### 手動検証

1. **CloudWatch Logs の確認**（ユーザーに依頼）
   - 最新の審査実行ログで上記パターンを検索
   - エラーコードの種別を確認（`timeout`, `connection_failed`, `provider_error`, `invalid_response`）

2. **修正デプロイ後の動作確認**
   - 投稿を送信して審査結果画面を確認
   - 全3審査員のスコアと成功/失敗表示を確認
   - 再審査ボタンが正しく動作することを確認

3. **フロントエンド型チェック**（オプション対応時）
   ```bash
   cd frontend
   npm run type-check
   ```
