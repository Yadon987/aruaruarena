# scripts/test_all.sh 高速化リファクタリング計画（レビュー反映版）

## 1. レビュー指摘（Issue_review.md準拠）

- [重要度: 高]
- 問題点: 並行ジョブの失敗時に、どの工程で失敗したかを即時判定できる条件が未明確（`wait`の終了コード収集・要約表示仕様が曖昧）。
- 改善提案: `static/vitest/dynamodb/rspec/ogp` を個別ステータスとして保持し、最終判定を「全ステータス0」で明文化する。

- [重要度: 高]
- 問題点: 固定待機 `sleep 5` 削除後の起動待機要件（最大待機秒数、失敗時の扱い）が曖昧。
- 改善提案: ポーリングを最大15回（1秒間隔）に固定し、到達時は明示的に失敗終了する。

- [重要度: 中]
- 問題点: 失敗ログ表示ルールが「どのログを出すか」だけで、成功時のログ非表示方針が仕様化されていない。
- 改善提案: 成功時はサマリのみ、失敗時は該当ジョブのログ全文のみ表示に統一する。

- [重要度: 中]
- 問題点: `--fast` の影響範囲が明確でない（どの処理をスキップするか）。
- 改善提案: `SKIP_BACKEND_OGP_IMAGE_BUILD=1` のみを付与し、OGPチェック自体は実行継続する。

- [重要度: 中]
- 問題点: RSpecのexit 2/3（カバレッジ警告）取り扱いが曖昧。
- 改善提案: `rspec_status` は成功扱いに変換し、別フラグで警告表示する。

- [重要度: 低]
- 問題点: Vitest待機の実時間削減が設計にあるが、テスト側の後片付け（タイマー復元）が不足。
- 改善提案: `beforeEach` で `vi.useFakeTimers()`、`afterEach` で `vi.useRealTimers()` を徹底する。

## 2. 修正版実装方針

### Phase 1（並行）
- Job A: `run_static_analysis`（RuboCop + Brakeman）
- Job B: `run_vitest`（`npm ci` + `npm run test`）
- Job C: `ensure_dynamodb`（ポーリング起動待機）

### Phase 2（直列）
- `run_rspec --format progress`
- `run_ogp_check`（BuildKit有効、`--fast`時はOGPイメージビルド再利用）

### ログ・終了判定
- ログ: `/tmp/aruaru_test_$$/*.log`
- 成功時: サマリのみ
- 失敗時: 失敗ジョブのログのみ表示
- 終了コード: 全ジョブ成功で `0`、1つでも失敗で `1`

## 3. 実装対象

- `scripts/test_all.sh`
  - 並行化（Phase 1）
  - `sleep 5` 削除、ポーリング待機へ統一
  - `--fast` オプション追加
  - `DOCKER_BUILDKIT=1` を有効化
  - RSpecフォーマットを `progress` に変更
  - 失敗ログのみ表示へ変更
- `frontend/package.json`
  - `vitest run --pool=forks` → `vitest run --pool=threads`
- `frontend/src/features/judging/__tests__/JudgingPolling.refactor.test.tsx`
  - フェイクタイマー導入
  - `setTimeout` 待機を `vi.advanceTimersByTimeAsync` に変更

## 4. 検証手順

```bash
bash -n scripts/test_all.sh
time bash scripts/test_all.sh --fast
```

必要時に通常モードも計測:

```bash
time bash scripts/test_all.sh
```
