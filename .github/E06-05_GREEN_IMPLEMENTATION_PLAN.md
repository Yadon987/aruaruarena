# E06-05: JudgePostServiceの実装（並列処理）実装プラン

作成日: 2026-02-11
Epic: E06 AI審査システム
ストーリー: E06-05 JudgePostServiceの実装（並列処理）

---

## 1. コンテキスト（背景）

### 現状の課題
- `JudgePostService` がスタブ実装状態（NotImplementedErrorをraise）
- 投稿API（E05）から審査トリガーが呼び出されるが、審査処理が未実装
- AI Adaptersは3つ実装済みだが、デヴィ婦人風（dewi）のアダプターが割り当てられていない

### 目的
- 3人のAI審査員による並列審査を実行
- 審査結果のDynamoDB保存
- 投稿ステータスの更新（judging → scored/failed）

---

## 2. 前提条件

### 既存リソース（再利用）

#### AI Adapters
| ファイル | ペルソナ | プロンプト | 状態 |
|---------|----------|-----------|------|
| `GeminiAdapter` | ひろゆき風 (hiroyuki) | hiroyuki.txt | ✅ 完了 |
| `GLMAdapter` | **ひろゆき風** (hiroyuki) | hiroyuki.txt | ✅ 完了 |
| `OpenAIAdapter` | 中尾彬風 (nakao) | nakao.txt | ✅ 完了 |

**課題**: デヴィ婦人風（dewi）のアダプターが未実装

**方針**: `GLMAdapter` は `hiroyuki` のままとし、新規に `DewiAdapter` を作成する

#### プロンプトファイル（既存）
- `backend/app/prompts/hiroyuki.txt` ✅
- `backend/app/prompts/dewi.txt` ✅
- `backend/app/prompts/nakao.txt` ✅

#### モデル（既存）
- `Post`: `update_status!`, `generate_score_key`, `calculate_rank` メソッドあり
- `Judgment`: `apply_persona_bias`, `calculate_total_score` メソッドあり

#### テストファイル
- `spec/services/judge_post_service_spec.rb` - 基本的な構造あり

---

## 3. 実装計画

### Phase 1: デヴィ婦人風アダプターの実装

**ファイル**: `backend/app/adapters/dewi_adapter.rb`（新規作成）

**仕様**:
- `GLMAdapter` をベースに実装（GLM-4-Flash使用）
- プロンプト: `app/prompts/dewi.txt`
- ペルソナ: `dewi`
- APIキー環境変数: `GLM_API_KEY`（hiroyukiと共通）

**理由**:
- GLMAdapterとOpenAI API形式が類似
- デヴィ婦人風用のプロンプトファイルが既に存在

### Phase 2: JudgePostServiceの実装

**ファイル**: `backend/app/services/judge_post_service.rb`（既存を修正）

#### 2.1 並列審査の設定

```ruby
# 審査員の設定
JUDGES = [
  { persona: 'hiroyuki', adapter: GeminiAdapter },
  { persona: 'dewi',     adapter: DewiAdapter },
  { persona: 'nakao',    adapter: OpenAiAdapter }
].freeze

# タイムアウト設定（Lambda環境を考慮）
PER_JUDGE_TIMEOUT = 90  # 各審査員のタイムアウト（秒）
JOIN_TIMEOUT = 120      # 全体のタイムアウト（秒）
```

#### 2.2 Threadによる並列実行

```ruby
def execute
  return if @post.nil?

  results = []
  threads = []
  mutex = Mutex.new

  JUDGES.each do |judge|
    threads << Thread.new do
      Thread.current[:persona] = judge[:persona]

      begin
        Rails.logger.info("[JudgePostService] 審査開始: persona=#{judge[:persona]}")

        adapter = judge[:adapter].new
        result = adapter.judge(@post.body, persona: judge[:persona])

        Thread.current[:result] = { persona: judge[:persona], result: result }

        if result.succeeded
          Rails.logger.info("[JudgePostService] 審査成功: persona=#{judge[:persona]}")
        else
          Rails.logger.warn("[JudgePostService] 審査失敗: persona=#{judge[:persona]}, error_code=#{result.error_code}")
        end
      rescue StandardError => e
        Rails.logger.error("[JudgePostService] 審査例外: persona=#{judge[:persona]}, error=#{e.class}:#{e.message}")
        Thread.current[:result] = {
          persona: judge[:persona],
          result: BaseAiAdapter::JudgmentResult.new(
            succeeded: false,
            error_code: 'thread_exception',
            scores: nil,
            comment: nil
          )
        }
      end
    end
  end

  # タイムアウト付きでThreadを待機
  threads.each do |thread|
    unless thread.join(JOIN_TIMEOUT)
      # タイムアウトしたスレッドを停止して競合状態を回避
      thread.kill
      Rails.logger.error("[JudgePostService] Thread timeout: persona=#{thread[:persona]}")

      # スレッドが完了していない場合のみタイムアウト結果を設定（ガード）
      thread[:result] ||= {
        persona: thread[:persona],
        result: BaseAiAdapter::JudgmentResult.new(
          succeeded: false,
          error_code: 'timeout',
          scores: nil,
          comment: nil
        )
      }
    end
  end

  results = threads.map { |t| t[:result] }.compact

  save_judgments!(results)
  update_post_status!
end
```

#### 2.3 審査結果の保存

```ruby
def save_judgments!(results)
  @successful_judgments = []

  results.each do |data|
    next unless data

    persona = data[:persona]
    result = data[:result]

    judgment = Judgment.new(
      post_id: @post.id,
      persona: persona,
      id: SecureRandom.uuid,
      succeeded: result.succeeded,
      error_code: result.error_code,
      judged_at: Time.now.to_i.to_s
    )

    if result.succeeded
      judgment.assign_attributes(
        empathy: result.scores[:empathy],
        humor: result.scores[:humor],
        brevity: result.scores[:brevity],
        originality: result.scores[:originality],
        expression: result.scores[:expression],
        total_score: Judgment.calculate_total_score(result.scores),
        comment: result.comment
      )
      @successful_judgments << judgment
    end

    judgment.save!
  end
end
```

#### 2.4 ステータス更新

```ruby
def update_post_status!
  succeeded_count = @successful_judgments.size

  @post.judges_count = succeeded_count

  if succeeded_count >= 2
    calculate_average_score!
    @post.update_status!(:scored)
    Rails.logger.info("[JudgePostService] 審査完了: status=scored, post_id=#{@post.id}, judges_count=#{succeeded_count}")
  else
    @post.update_status!(:failed)
    Rails.logger.info("[JudgePostService] 審査失敗: status=failed, post_id=#{@post.id}, judges_count=#{succeeded_count}")
  end
end

def calculate_average_score!
  return if @successful_judgments.empty?

  total = @successful_judgments.sum(&:total_score)
  # 小数第1位に丸める（85.333... -> 85.3）
  @post.average_score = (total.to_f / @successful_judgments.size).round(1)
end
```

### Phase 3: テストの実装

**ファイル**: `spec/services/judge_post_service_spec.rb`

#### 3.1 Red（テスト先書き）

##### 正常系
- **3人全員成功**: status: scored, average_score: 正常に計算される
- **2人成功、1人失敗**: status: scored, average_score: 2人の平均で計算
- **1人成功、2人失敗**: status: failed

##### 異常系
- **全員失敗**: status: failed
- **Postが削除されている**: 何もしない、エラーをraiseしない
- **Thread内で例外発生**: 例外をキャッチし、失敗として記録

##### 境界値・混合パターン
- **1人成功、1人失敗、1人タイムアウト**: status: failed
- **2人成功、1人APIエラー**: status: scored

##### パフォーマンス
- **並列実行の検証**: 3人の審査員が同時に実行される

---

## 4. 実装するファイル一覧

### 新規作成
1. `backend/app/adapters/dewi_adapter.rb`
2. `backend/spec/adapters/dewi_adapter_spec.rb`

### 修正
1. `backend/app/services/judge_post_service.rb`（本体実装）
2. `backend/spec/services/judge_post_service_spec.rb`（テスト追加）

---

## 5. テスト計画（TDD）

### Unit Test (Adapter)
- [ ] `DewiAdapter` の初期化テスト
- [ ] API呼び出し成功時のテスト
- [ ] API呼び出し失敗時のテスト
- [ ] リトライ処理のテスト
- [ ] プロンプトファイル読み込みのテスト

### Unit Test (Service)
- [ ] 並列実行のテスト（3人の審査員が同時に実行される）
- [ ] 審査結果保存のテスト（成功・失敗両方）
- [ ] ステータス更新のテスト（scored/failed）
- [ ] 平均点計算のテスト（小数点以下の丸め）
- [ ] Thread内例外発生時のテスト
- [ ] タイムアウト発生時のテスト
- [ ] Postがnilの場合のテスト

### Integration Test
- [ ] `JudgePostService.call` からのエンドツーエンドテスト
- [ ] DynamoDBへの保存確認
- [ ] Postステータスの更新確認

---

## 6. 受入条件

### 正常系
- [ ] 3人のAI審査員が並列で審査を実行できる
- [ ] 3人全員成功時: status: scored, judges_count: 3
- [ ] 2人成功時: status: scored, judges_count: 2
- [ ] 成功した審査結果がJudgmentテーブルに保存される
- [ ] 平均点が計算されPostに保存される（小数第1位）

### 異常系
- [ ] APIタイムアウト時に適切にエラーハンドリングされる
- [ ] Thread内で例外発生時に失敗として記録される
- [ ] Postが削除されている場合は何もしない

### 境界値
- [ ] 全員失敗時: status: failed, judges_count: 0
- [ ] 1人成功時: status: failed, judges_count: 1
- [ ] 2人成功時: status: scored, judges_count: 2

### 非機能要件
- [ ] N+1クエリが発生しない（Judgmentのクエリを再利用）
- [ ] 適切なログ出力が行われる（開始・成功・失敗・例外）
- [ ] Lambda環境のタイムアウト制限を考慮した実装

---

## 7. 検証手順

```bash
# 1. テスト実行
cd backend
bundle exec rspec spec/services/judge_post_service_spec.rb
bundle exec rspec spec/adapters/dewi_adapter_spec.rb

# 2. 全体テスト
bundle exec rspec

# 3. RuboCop
bundle exec rubocop -A

# 4. 動作確認（Rails console）
bundle exec rails console
post = Post.create(nickname: "テスト", body: "スヌーズ押して二度寝")
JudgePostService.call(post.id)
post.reload
puts post.status  # scored または failed
puts post.average_score  # 平均点

# 5. Judgmentの確認
judgments = Judgment.where(post_id: post.id)
judgments.each do |j|
  puts "#{j.persona}: #{j.succeeded ? '成功' : '失敗'}"
  puts "  スコア: #{j.total_score}" if j.succeeded
end
```

---

## 8. 関連資料

- `docs/epics.md` - E06 AI審査システム
- `docs/db_schema.md` - judgmentsテーブル定義
- `CLAUDE.md` - コーディングルール

---

## 9. 注記

### 今回の実装範囲
- 初回審査のみを対象とする
- 再審査（E11）での既存Judgmentの上書き処理は、E11で実装

### GLM APIの共通利用
- `GLMAdapter`（hiroyuki）と `DewiAdapter` で同じAPIキーを使用
- GLM APIのレート制限に注意が必要
