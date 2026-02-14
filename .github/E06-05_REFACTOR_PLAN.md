# E06-05 リファクタリング実装プラン

作成日: 2026-02-12
更新日: 2026-02-12（ユーザー指摘反映）
Epic: E06 AI審査システム
ストーリー: E06-05 JudgePostServiceの実装（並列処理）
フェーズ: REFACTOR

---

## 1. コンテキスト（背景）

### 目的
- 実装済みのコードベースを分析し、リファクタリングによるコード品質の向上を図る
- E06-05の実装完了後の技術的負債を軽減
- 将来の機能追加（E11-E13）を見据えた、拡張性の高いコード構造にする

### 現状の課題

**DewiAdapter**:
- GLMAdapterのコードコピーであり、重複がある
- 共通ロジック（リトライ、JSONパース、スコア変換）が3つのAdapterクラスで重複

**JudgePostService**:
- 50行のexecuteメソッド（複雑度の指摘あり）
- 117行のクラス（RuboCopの警告）
- 複数のスレッド操作があり、可読性が低い

**テスト**:
- プロンプトキャッシュのテスト分離が必要
- Mock設定が複雑で、テストの保守性が低い

---

## 2. コードベース分析

### 2.1 Adapter共通化の可能性

**共通ロジック**:
- リトライ処理（MAX_RETRIES=3、指数バックオフ）
- JSONパース（コードブロックからのJSON抽出）
- スコア変換（整数への丸め）
- コメント切り詰め（MAX_COMMENT_LENGTH）

**現在の重複**:
```ruby
# GeminiAdapter (32行)
def parse_response(response)
  body = response.body
  parsed = body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body
  content = parsed.dig(:choices, 0, :message, :content)
  json_text = extract_json_from_codeblock(content)
  data = JSON.parse(json_text, symbolize_names: true)
  scores = convert_scores_to_integers(data)
  comment = truncate_comment(data[:comment])
  { scores: scores, comment: comment }
rescue JSON::ParserError => e
  invalid_response_error
end

# GLMAdapter (32行)
def parse_response(response)
  # GeminiAdapterと同じ実装
end

# DewiAdapter (157行)
def parse_response(response)
  # GLMAdapterと同じ実装
end

# OpenAiAdapter (119行)
def parse_response(response)
  # GeminiAdapterと同じ実装
end
```

**抽象化のメリット**:
- BaseAiAdapter::JudgmentResult構造体の再利用
- スレッドセーフな並列実行ロジック（JudgePostServiceから抽出）
- プロンプト読み込みロジック（load_promptメソッド）

**既存の抽象化**:
- `BaseAiAdapter` クラスで共通処理を実装済み
- `JudgmentResult` 構造体でスコアとコメントを保持

---

### 2.2 JudgePostServiceの改善点

**現在の問題点**:
1. **スレッド管理**
   - Thread.newブロックがネスト深度3で可読性が低い
   - Threadオブジェクトへのpersona代入が不透明

2. **エラーハンドリング**
   - `rescue StandardError => e` で例外をキャッチ
   - ただし、タイムアウト時の処理が不十分（`thread.join(JOIN_TIMEOUT)` 後のpersona参照）
   - スレッド固有の結果保持が必要（現在はハッシュ参照）

**実装内容**:
1. `app/services/adapters/ai_adapter_service.rb`（新規作成）
2. `app/services/adapters/base_ai_adapter_concern.rb`（新規作成）

**モジュール構成**:
```ruby
# app/services/adapters/ai_adapter_service.rb
module Adapters
  class AiAdapterService
    def initialize(adapter_class)
      @adapter_class = adapter_class
      @adapter = adapter_class.new
    end

    def judge(post_content, persona:, metadata: {})
      @adapter.judge(post_content, persona: persona)
    end
  end
end

# app/services/judge_post_service.rb
class JudgePostService
  attr_reader :judges

  def initialize(post_id)
    @post = Post.find(post_id)
    @ai_service = Adapters::AiAdapterService.new
  end

  private

  def execute
    # ai_service経由で審査を実行
    results = @ai_service.parallel_judge(@post, @judges)

    save_judgments!(results)
    update_post_status!
  end
end
```

**期待される効果**:
- 重複排除： parse_response, convert_scores, truncate_commentが一箇所に集約
- 可読性向上： 並列処理のロジックが1クラスに集約
- テスト容易化： Adapterのモックが単純化

---

### 3.2 スレッド管理の改善（中優先度）

**問題**: Thread.newブロックが可読性を低下

**解決策**: ThreadPoolまたはConcurrentFutureの導入検討

**実装内容**:
```ruby
require 'concurrent'

class JudgePostService
  JOIN_TIMEOUT = 120
  JUDGES = [...].freeze

  def initialize(post_id)
    @post = Post.find(post_id)
    @executor = Concurrent::ThreadPoolExecutor.new(
      min_threads: 3,
      max_threads: 3,
      fallback_policy: :abort
    )
  end

  def execute
    return if @post.nil?

    futures = @judges.map do |judge|
      Concurrent::Future.execute(executor: @executor) do
        adapter = judge[:adapter].new
        adapter.judge(@post.body, persona: judge[:persona])
      end
    end

    results = futures.map(&:value!)
    save_judgments!(results)
    update_post_status!
  end
end
```

**期待される効果**:
- スレッド管理の標準化（ThreadPool/ConcurrentFuture使用）
- 可読性の大幅向上
- デバッグ容易性の向上
- エラー処理の改善

---

### 3.3 カスタム例外クラスの導入（中優先度）

**問題**: 例外処理が不十分統一されている

**解決策**: カスタム例外クラスの導入

**実装内容**:
```ruby
# app/services/judge_error.rb（新規作成）
class JudgeError < StandardError
  attr_reader :persona, :error_code, :original_error

  def initialize(persona, error_code, original_error = nil)
    @persona = persona
    @error_code = error_code
    @original_error = original_error
  end

  def to_h
    {
      persona: @persona,
      error_code: @error_code,
      message: @original_error&.message || '審査エラーが発生しました'
    }
  end
end

# app/services/judge_post_service.rb（修正）
class JudgePostService
  private

  def execute
    return if @post.nil?

    # ThreadPool使用した並列審査
    futures = @judges.map do |judge|
      Concurrent::Future.execute(executor: @executor) do
        adapter = judge[:adapter].new
        adapter.judge(@post.body, persona: judge[:persona])
      end
    end

    results = futures.map(&:value!)

    save_judgments!(results)
    update_post_status!
  end
end
```

**期待される効果**:
- 例外処理の標準化
- エラーハンドリングの一貫性確保
- トラブルシューティングが容易に

---

### 3.4 テスト保守性の向上（低優先度）

**問題**: Mock設定が複雑

**解決策**: 共通テストヘルパーの導入

**実装内容**:
```ruby
# spec/support/adapter_test_helpers.rb（拡張）
module AdapterTestHelpers
  # 既存のメソッドを保持

  # 共通の成功レスポンスモック
  def create_success_response(scores:, comment:)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: scores,
      comment: comment
    )
  end

  # 共通のタイムアウトレスポンスモック
  def create_timeout_response
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: 'timeout',
      scores: nil,
      comment: nil
    )
  end

  # 共通のAPIエラーレスポンスモック
  def create_api_error_response(error_code:)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: error_code,
      scores: nil,
      comment: nil
    )
  end

  # Adapterをモックするヘルパー
  def mock_adapter_judge(adapter_class, success: true)
    allow_any_instance_of(adapter_class).to receive(:judge).and_return(
      success ? create_success_response(
        scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
        comment: 'テストコメント'
      ) : create_timeout_response
    )
  end
end

# RSpecの設定
RSpec.configure do |config|
  config.before(:each, :adapter) do
    # 共通のモック設定を適用
    adapter_test_helpers.mock_adapter_judge(GeminiAdapter)
    adapter_test_helpers.mock_adapter_judge(GLMAdapter)
    adapter_test_helpers.mock_adapter_judge(DewiAdapter)
    adapter_test_helpers.mock_adapter_judge(OpenAiAdapter)
  end
end
```

**期待される効果**:
- テストの一貫性向上
- Mock設定の簡素化
- テスト実装速度の向上

---

## 4. 実装計画

### 4.1 Adapter共通モジュールの抽出（高優先度）

**手順**:
1. BaseAiAdapterのparse_responseをモジュールへ抽出
2. 3つのAdapterクラスをリファクタ
3. JudgePostServiceをAiAdapterServiceを使用するように変更

**期待される効果**:
- コード重複が大幅に削減
- 拡張性の高いコード構造

### 4.2 ThreadPoolの導入（中優先度）

**手順**:
1. Concurrentライブラリの使用確認
2. JudgePostServiceをThreadPoolに移行
3. タイムアウト処理の改善

**期待される効果**:
- スレッド管理の近代化
- 可読性の向上
- メンテナンス性の向上

### 4.3 カスタム例外クラスの導入（中優先度）

**手順**:
1. JudgeErrorクラスを作成
2. 例外処理をJudgeErrorでラップ
3. エラーハンドリングの改善

**期待される効果**:
- 例外処理の標準化
- トラブルシューティングが容易に

### 4.4 テスト保守性の向上（低優先度）

**手順**:
1. 共通テストヘルパーの実装
2. Mockヘルパーの適用

**期待される効果**:
- テストの保守性が向上
- テスト実装の簡素化

---

## 5. 期待される成果

### コード品質
- **Cyclomatic Complexity**: 大幅に低減
- **Method Length**: メソッドが50行以内に収まる
- **コード重複**: 共通ロジックで約300行削除
- **テストカバレッジ**: 90%以上を維持

### 生産性
- **拡張性**: 高い凝集度・低結合
- **保守性**: テストが書きやすく、バグ修正が容易
- **ドキュメント**: コード構造と設計思想が明確化

---

## 6. 実装スケジュール

### Phase 1: Adapter共通モジュールの抽出（4-6時間）
- [ ] BaseAiAdapterから共通処理をモジュールへ抽出
- [ ] AiAdapterServiceクラスの作成と使用
- [ ] DewiAdapter, GLMAdapterをリファクタリングして重複を排除
- [ ] JudgePostServiceをAiAdapterServiceを使用するように変更

### Phase 2: スレッド管理の改善（3-4時間）
- [ ] Concurrentライブラリの導入
- [ ] JudgePostServiceをThreadPoolに移行
- [ ] スレッド固有の結果保持の改善

### Phase 3: カスタム例外クラスの導入（2-3時間）
- [ ] JudgeErrorクラスの作成
- [ ] 例外処理の改善

### Phase 4: テスト保守性の向上（1-2時間）
- [ ] 共通テストヘルパーの実装
- [ ] Mockヘルパーの適用と簡素化

---

## 7. 検証手順

```bash
# 1. プラン確認
cat .github/E06-05_REFACTOR_PLAN.md

# 2. パッケージ確認
git diff HEAD~1

# 3. 実装開始
# ここからフェーズ1を開始
```

---

## 8. 注意点

### 実装上の注意
1. **既存機能への影響**: JudgePostServiceのロジック変更は他クラスやサービスに影響
2. **データ整合性**: Judgmentレコードの変更は既存データと互換性が必要
3. **バックワード**: リファクタリング前は必ずデータバックアップを取得
4. **スレッドセーフティ**: Mutexの使用に加え、Concurrent使用時は適切な同期メカニズムが必要

### 制約条件
- テストカバレッジを90%以上維持
- 既存機能への影響を最小限にする
- バックワード必須

---

## 9. 次期フェーズ

**Phase 1完了後**（4-6時間）:
- [ ] Adapter共通モジュールが作成され、重複が排除
- [ ] ThreadPool/ConcurrentFutureが導入され、スレッド管理が改善
- [ ] JudgeErrorクラスで例外処理が標準化
- [ ] テストヘルパーが実装され、保守性が向上

**Phase 2完了後**（6-8時間）:
- [ ] 全てのリファクタリングが完了
- [ ] コード品質メトリクスが満たされる
- [ ] テストスイートが実行され、全テストがパス

---

## 10. 次期フェーズから移行

**次のステップ（段階的実施）**:
1. **Adapter共通化**: BaseAiAdapterからモジュールを抽出し直ちに実装開始
2. **テスト改善**: 共通ヘルパーを実装し、Mock設定を簡素化
3. **プロダクション準備**: 開発環境（Lambda）でリファクタリングを実行するための準備

---

## 11. 参考

### 内部資料
- `backend/app/adapters/base_ai_adapter.rb` - 既存の共通実装
- `backend/app/adapters/*_adapter.rb` - 各Adapterの実装（Gemini, GLM, OpenAI）
- `backend/app/services/judge_post_service.rb` - 現在の並列審査ロジック
- `spec/support/*_adapter_spec.rb` - 既存のAdapterテスト
- Railsガイド: https://railsguides.jp/ 、 Concurrent Rubyドキュメント

---

## 12. まとめ

E06-05のリファクタリングは、以下の4つの観点から体系的にコードベースを改善します：

1. **保守性の向上**: 共通化、モジュール化、例外処理の標準化
2. **可読性の向上**: ThreadPool/ConcurrentFutureの導入、スレッド管理の改善
3. **拡張性の確保**: モジュール構造、疎結合な設計
4. **テスト品質の向上**: 共通ヘルパー、Mock設定の簡素化

これらの改善により、**将来の機能追加（E11-E13）**が容易になり、**技術的負債が大幅に軽減**されます。

---

END OF PLAN
