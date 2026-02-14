# E06-05: JudgePostServiceの実装（並列処理）実装プラン

作成日: 2026-02-11
更新日: 2026-02-12（レビュー反映）
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
- `spec/services/judge_post_service_spec.rb` - **新規作成**

---

## 3. 実装計画

### Phase 1: デヴィ婦人風アダプターの実装

**ファイル**: `backend/app/adapters/dewi_adapter.rb`（新規作成）

**仕様**:
- `GLMAdapter` の実装をコピーして作成（継承ではない）
- 変更点:
  - クラス名: `DewiAdapter`
  - プロンプト: `app/prompts/dewi.txt`
  - ペルソナ: `dewi`
  - APIキー環境変数: `GLM_API_KEY`（hiroyukiと共通）

**理由**:
- GLM APIのエンドポイントとリクエスト形式が共通
- デヴィ婦人風用のプロンプトファイルが既に存在

**注意点**:
- GLM APIのレート制限に注意（GLMAdapterとDewiAdapterが同じAPIキーを使用）
- レート制限エラー（429）時は、既存のリトライ処理（MAX_RETRIES=3）で対応

### Phase 2: JudgePostServiceの実装

**ファイル**: `backend/app/services/judge_post_service.rb`（既存を修正）

#### 2.1 並列審査の設定

```ruby
# 審査員の設定（固定3名）
JUDGES = [
  { persona: 'hiroyuki', adapter: GeminiAdapter },
  { persona: 'dewi',     adapter: DewiAdapter },
  { persona: 'nakao',    adapter: OpenAiAdapter }
].freeze

# タイムアウト設定（Lambda環境を考慮）
PER_JUDGE_TIMEOUT = 90  # 各審査員のタイムアウト（秒）
JOIN_TIMEOUT = 120      # 全体のタイムアウト（秒）

# Lambda推奨設定
# - メモリ: 512MB以上
# - タイムアウト: 150秒以上
```

#### 2.2 Threadによる並列実行（改善版）

```ruby
def execute
  return if @post.nil?

  # Thread固有の結果を格納するスレッドセーフなハッシュ
  results = {}
  threads = []
  results_mutex = Mutex.new

  JUDGES.each do |judge|
    threads << Thread.new do
      persona = judge[:persona]
      result = nil

      begin
        Rails.logger.info("[JudgePostService] 審査開始: persona=#{persona}")

        adapter = judge[:adapter].new
        result = adapter.judge(@post.body, persona: persona)

        if result.succeeded
          Rails.logger.info("[JudgePostService] 審査成功: persona=#{persona}")
        else
          Rails.logger.warn("[JudgePostService] 審査失敗: persona=#{persona}, error_code=#{result.error_code}")
        end
      rescue StandardError => e
        # e.message にはAPIキー等の機密情報が含まれる可能性があるため、クラス名のみ記録
        Rails.logger.error("[JudgePostService] 審査例外: persona=#{persona}, error_class=#{e.class}")
        result = BaseAiAdapter::JudgmentResult.new(
          succeeded: false,
          error_code: 'thread_exception',
          scores: nil,
          comment: nil
        )
      ensure
        # 結果をスレッドセーフに格納
        results_mutex.synchronize do
          results[persona] = { persona: persona, result: result }
        end
      end
    end
  end

  # タイムアウト付きでThreadを待機
  threads.each do |thread|
    unless thread.join(JOIN_TIMEOUT)
      # タイムアウトしたスレッドは強制終了せず、自然終了を待つ
      # 結果が未設定の場合はタイムアウトとして記録
      persona = thread[:persona]
      results_mutex.synchronize do
        results[persona] ||= {
          persona: persona,
          result: BaseAiAdapter::JudgmentResult.new(
            succeeded: false,
            error_code: 'timeout',
            scores: nil,
            comment: nil
          )
        }
      end
      Rails.logger.error("[JudgePostService] Thread timeout: persona=#{persona}")
    end
  end

  # 結果を配列に変換
  results_array = results.values

  save_judgments!(results_array)
  update_post_status!
end
```

**変更点**:
1. Thread固有の変数（`thread[:result]`）の代わりに、スレッドセーフなハッシュを使用
2. Thread.kill を使用せず、タイムアウト時も自然終了を待つ設計に変更
3. エラーログから `e.message` を削除し、機密情報漏洩リスクを低減

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
  # 四捨五入で小数第1位に丸める（85.35 -> 85.4, 85.34 -> 85.3）
  @post.average_score = (total.to_f / @successful_judgments.size).round(1)
end
```

**丸めルール**: Rubyの `round(1)` は「四捨五入」を採用（JIS規格Z 8401に準拠）

### Phase 3: テストの実装

**ファイル**: `spec/services/judge_post_service_spec.rb`（新規作成）

#### 3.1 Unit Test（Adapter）

**ファイル**: `spec/adapters/dewi_adapter_spec.rb`（新規作成）

##### テスト項目
- [ ] `DewiAdapter` の初期化テスト
- [ ] API呼び出し成功時のテスト
- [ ] API呼び出し失敗時のテスト（timeout, connection_failed, provider_error, invalid_response）
- [ ] リトライ処理のテスト（MAX_RETRIES=3、指数バックオフ）
- [ ] プロンプトファイル読み込みのテスト
- [ ] スコアバリデーションのテスト（0-20の範囲、必須キー）
- [ ] コメント切り詰めのテスト（30文字制限）

#### 3.2 Unit Test（Service）

**ファイル**: `spec/services/judge_post_service_spec.rb`（新規作成）

##### 正常系
```ruby
context '正常系' do
  # 3人全員成功: status: scored, judges_count: 3, average_score: 正常に計算
  it '3人全員成功時にstatus: scoredになること' do
    # Mockアダプターで成功結果を返す
    # 呼び出し後に post.reload で status, judges_count, average_score を検証
  end

  # 2人成功、1人失敗: status: scored, judges_count: 2
  it '2人成功時にstatus: scoredになること' do
    # 1人のアダプターで失敗結果を返す
  end

  # 平均点計算: 小数第1位に丸められる
  it '平均点が小数第1位に丸められること' do
    # 例: 85 + 90 + 87 = 262 / 3 = 87.333... -> 87.3
  end
end
```

##### 異常系
```ruby
context '異常系' do
  # 全員失敗: status: failed, judges_count: 0
  it '全員失敗時にstatus: failedになること' do
    # 全てのアダプターで失敗結果を返す
  end

  # 1人成功、2人失敗: status: failed, judges_count: 1
  it '1人成功時にstatus: failedになること' do
    # 2人のアダプターで失敗結果を返す
  end

  # Postが削除されている: 何もしない、エラーをraiseしない
  it 'Postが削除されている場合は何もしないこと' do
    service = JudgePostService.new('nonexistent_id')
    expect { service.execute }.not_to raise_error
  end

  # Thread内で例外発生: 例外をキャッチし、失敗として記録
  it 'Thread内で例外発生時に失敗として記録されること' do
    # アダプターで例外を発生させる
    # 結果が error_code: 'thread_exception' になることを検証
  end
end
```

##### 境界値・タイムアウト
```ruby
context '境界値・タイムアウト' do
  # タイムアウト発生: error_code: 'timeout'
  it 'タイムアウト発生時にerror_code: timeoutになること' do
    # アダプターでスリープしてタイムアウトを発生させる
  end

  # 1人成功、1人失敗、1人タイムアウト: status: failed
  it '混合パターンで正しくステータスが決まること' do
    # 各アダプターで異なる結果を返す
  end
end
```

##### 並列実行の検証
```ruby
context '並列実行' do
  # 3人の審査員が同時に実行されることを検証
  it '3人の審査員が同時に実行されること' do
    # 方法1: 実行時刻を記録し、時間差が閾値（100ms）以内であることを確認
    start_times = {}
    allow_any_instance_of(GeminiAdapter).to receive(:judge) do
      start_times[:hiroyuki] = Time.now
      sleep 0.1
      success_result
    end
    # 同様にdewi, nakaoも記録
    # 全ての開始時刻の差分が100ms以内であることを検証
  end
end
```

#### 3.3 Integration Test

**ファイル**: `spec/services/judge_post_service_spec.rb`（既存ファイルに追加）

```ruby
context 'Integration Test' do
  # JudgePostService.call からのエンドツーエンドテスト
  it 'JudgePostService.callで審査が完了すること' do
    # AdapterはMock、Serviceは実装
    # DynamoDBはテスト用テーブルを使用
    post = Post.create(nickname: 'テスト', body: 'スヌーズ押して二度寝')
    JudgePostService.call(post.id)
    post.reload
    expect(post.status).to eq('scored').or eq('failed')
  end

  # DynamoDBへの保存確認
  it '審査結果がJudgmentテーブルに保存されること' do
    # Judgment.where(post_id: post.id) で保存を確認
  end

  # Postステータスの更新確認
  it 'Postのステータスと平均点が更新されること' do
    # post.status, post.average_score, post.judges_count を検証
  end
end
```

**Integration Test の環境**:
- Adapter: Mock（WebMock/rspec-mocksを使用）
- Service: 実装
- DynamoDB: テスト用テーブル（DynamoDB LocalまたはAWS開発用テーブル）

---

## 4. 実装するファイル一覧

### 新規作成
1. `backend/app/adapters/dewi_adapter.rb`
2. `backend/spec/adapters/dewi_adapter_spec.rb`
3. `backend/spec/services/judge_post_service_spec.rb`

### 修正
1. `backend/app/services/judge_post_service.rb`（本体実装）

---

## 5. テスト計画（TDD）

### Unit Test (Adapter)
- [ ] `DewiAdapter` の初期化テスト
- [ ] API呼び出し成功時のテスト
- [ ] API呼び出し失敗時のテスト（timeout, connection_failed, provider_error, invalid_response）
- [ ] リトライ処理のテスト（MAX_RETRIES=3、指数バックオフ）
- [ ] プロンプトファイル読み込みのテスト
- [ ] スコアバリデーションのテスト
- [ ] コメント切り詰めのテスト

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
- [ ] 3人全員成功時: status: scored, judges_count: 3, average_score: 正常に計算
- [ ] 2人成功時: status: scored, judges_count: 2, average_score: 2人の平均
- [ ] 成功した審査結果がJudgmentテーブルに保存される
- [ ] 平均点が小数第1位に丸められる（四捨五入）

### 異常系
- [ ] APIタイムアウト時に error_code: 'timeout' で適切にエラーハンドリングされる
- [ ] Thread内で例外発生時に error_code: 'thread_exception' で失敗として記録される
- [ ] Postが削除されている場合は何もしない
- [ ] 全員失敗時: status: failed, judges_count: 0
- [ ] 1人成功時: status: failed, judges_count: 1

### 境界値
- [ ] 2人成功時: status: scored, judges_count: 2

### 非機能要件
- [ ] N+1クエリが発生しない（Judgmentのクエリを再利用）
- [ ] 適切なログ出力が行われる（開始・成功・失敗・例外）
  - [ ] エラーログに機密情報（APIキー等）が含まれない
- [ ] Lambda環境のタイムアウト制限を考慮した実装
  - [ ] 推奨メモリ: 512MB以上
  - [ ] 推奨タイムアウト: 150秒以上
- [ ] Thread.kill を使用せず、タイムアウト時も自然終了を待つ設計
- [ ] スレッドセーフなデータ構造を使用

---

## 7. 検証手順

```bash
# 1. テスト実行
cd backend
bundle exec rspec spec/services/judge_post_service_spec.rb
bundle exec rspec spec/adapters/dewi_adapter_spec.rb

# 2. 全体テスト
bundle exec rspec

# 3. カバレッジレポート
COVERAGE=true bundle exec rspec

# 4. RuboCop
bundle exec rubocop -A

# 5. 動作確認（Rails console）
bundle exec rails console
post = Post.create(nickname: "テスト", body: "スヌーズ押して二度寝")
JudgePostService.call(post.id)
post.reload
puts post.status  # scored または failed
puts post.average_score  # 平均点

# 6. Judgmentの確認
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
- `backend/app/adapters/base_ai_adapter.rb` - 基底クラス
- `backend/app/adapters/glm_adapter.rb` - DewiAdapterの実装参考

---

## 9. 注記

### 今回の実装範囲
- 初回審査のみを対象とする
- 再審査（E11）での既存Judgmentの上書き処理は、E11で実装
- 審査員は3名固定（hiroyuki, dewi, nakao）

### GLM APIの共通利用
- `GLMAdapter`（hiroyuki）と `DewiAdapter` で同じAPIキーを使用
- GLM APIのレート制限に注意が必要
- レート制限エラー（429）時は、既存のリトライ処理（MAX_RETRIES=3）で対応

### Thread設計の安全性
- Thread.kill は使用せず、タイムアウト時も自然終了を待つ設計
- Thread固有の変数の代わりに、スレッドセーフなハッシュを使用
- エラーログから `e.message` を削除し、機密情報漏洩リスクを低減

### 丸めルール
- 平均点の丸めは `round(1)` を使用（四捨五入、JIS規格Z 8401準拠）
- 例: 87.333... -> 87.3, 87.35 -> 87.4
