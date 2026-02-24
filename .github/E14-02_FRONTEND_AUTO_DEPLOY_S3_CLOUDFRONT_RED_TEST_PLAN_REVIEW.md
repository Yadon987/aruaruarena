- [重要度: 高]
- 問題点: AC-09（同日複数デプロイで独立判定）のテスト根拠が弱く、`concurrency` やジョブ識別子の検証観点が不足している。
- 改善提案: `concurrency.group` と `cancel-in-progress: false` を必須検証に追加し、独立判定可能性を静的に担保するテストを定義する。

- [重要度: 高]
- 問題点: AC-10（手動再実行の冪等性）を `workflow_dispatch.inputs.rollback_run_id` の存在だけで代替しており、再実行時の同一成果物再同期条件が明示されていない。
- 改善提案: 「同一 `rollback_run_id` で2回実行しても同一コマンド列になる」ことを擬似実行で検証するテスト観点を追加する。

- [重要度: 中]
- 問題点: AC-03（最新画面取得可能）の検証が実ブラウザ確認を前提としており、RED段階で実施不能な受入基準との対応が曖昧。
- 改善提案: REDでは代理指標として「invalidation作成 + 完了待機ステップの定義と失敗停止」を検証対象に明確化し、Green/E2Eでの実画面確認を別途扱うことを明記する。

- [重要度: 中]
- 問題点: RED無効失敗の定義に「テスト対象ファイル未作成」を誤って環境要因扱いする余地がある。
- 改善提案: `deploy-frontend.yml` / `docs/deploy/frontend.md` 未作成は仕様未実装として有効失敗であると明記する。

- [重要度: 低]
- 問題点: コミット方針は記載済みだが、複数コミット時の全コミットにIssue番号を付与するルールが曖昧。
- 改善提案: 「分割コミット時も全コミットで #67 を付与」を追記する。

完全版:

```md
# REDテスト計画書（改訂版）: E14-02 S3同期とCloudFront invalidation

## 0. 目的

`.github/E14-02_FRONTEND_AUTO_DEPLOY_S3_CLOUDFRONT_SPEC_PLAN.md` の受入条件（AC）を、TDDのREDフェーズで先に失敗テストとして固定する。

- 対象: `deploy-frontend.yml` のS3同期、CloudFront invalidation作成/完了待機、失敗時サマリー、artifact保存、rollback実行条件
- ゴール: 実装前に仕様境界をテストとして明文化し、Green実装時の判断ブレを防ぐ

---

## 1. 前提・制約（CLAUDE.md準拠）

- REDフェーズでは本番ワークフロー本体を変更しない（テストコードとテスト補助ファイルのみ追加）
- REDテストは必ず失敗する状態で追加する
- 初回RED実行で AC対応テストが **最低5件以上失敗** することを成立条件とする
- 失敗理由は仕様未実装・仕様不一致に限定し、構文エラー起因の失敗を禁止する
- `.github/workflows/deploy-frontend.yml` / `docs/deploy/frontend.md` 未作成は「仕様未実装」として有効失敗に含める
- 各テストケースに `何を検証するか` の日本語コメントを必ず記述する
- `skip` / `todo` / `pending` を使用しない
- 機密情報（AWSキー・トークン）をテストコードに直接記載しない
- テスト名、コメント、コミットメッセージは日本語で記述する

---

## 2. RED失敗条件

REDとして有効な失敗:

- `.github/workflows/deploy-frontend.yml` が存在しない
- `Sync assets to S3` / `Create CloudFront invalidation` / `Wait CloudFront invalidation completed` が未定義
- `aws s3 sync dist ... --delete --exact-timestamps` の要件を満たさない
- `aws cloudfront create-invalidation` と `aws cloudfront wait invalidation-completed` の順序要件を満たさない
- `if: failure()` 条件つきの `Publish failure summary` が未定義
- `frontend-dist` artifact保存（30日）が未定義
- `workflow_dispatch.inputs.rollback_run_id` が未定義
- `concurrency.group` または `cancel-in-progress: false` が未定義

REDとして無効（修正対象）:

- YAMLパーサやテストランナー未導入による失敗
- テストコードのimport/型エラー
- ローカル権限不足やネットワーク遮断など環境要因のみの失敗

判定ルール:

- AC対応テストは初回実行で最低5件以上失敗すること
- 失敗ログで仕様未実装/不一致を識別できること
- 無効失敗（環境要因）が0件であること

---

## 3. スコープ

### 3.1 対象
- ワークフローファイル存在確認
- S3同期ステップ定義とコマンド引数（`--delete`, `--exact-timestamps`）
- invalidation作成ステップと完了待機ステップ
- `dist` 存在確認ステップ
- `if: failure()` の失敗サマリー出力
- `frontend-dist` artifact保存条件（保持30日）
- `workflow_dispatch` + `rollback_run_id` 入力定義
- `concurrency` 設定（`group`, `cancel-in-progress: false`）
- `docs/deploy/frontend.md` のロールバック手順とIAM最小権限記載

### 3.2 非対象
- AWS実環境への実デプロイ
- CloudFront実配信の実ブラウザ確認（Green/E2Eで実施）
- Slack通知など外部通知連携

---

## 4. 仕様固定値（テスト正本）

- 対象ワークフロー: `.github/workflows/deploy-frontend.yml`
- 必須ステップ名:
  - `Verify dist directory`
  - `Sync assets to S3`
  - `Create CloudFront invalidation`
  - `Wait CloudFront invalidation completed`
  - `Publish failure summary`
  - `Upload deploy artifact`
- 必須S3同期コマンド:
  - `aws s3 sync dist s3://$S3_BUCKET_FRONTEND --delete --exact-timestamps`
- 必須invalidationコマンド:
  - `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'`
  - `aws cloudfront wait invalidation-completed --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --id <invalidation_id>`
- 必須変数:
  - `S3_BUCKET_FRONTEND`
  - `CLOUDFRONT_DISTRIBUTION_ID`
- ロールバック必須入力:
  - `workflow_dispatch.inputs.rollback_run_id`
- artifact:
  - 名称: `frontend-dist`
  - 保持: `30` 日
- concurrency:
  - `group: deploy-frontend-${{ github.ref }}`
  - `cancel-in-progress: false`

---

## 5. ACトレース

- AC-01: `main` pushで build後にS3同期し、invalidation完了待機まで成功
- AC-02: `--delete` で不要ファイルを削除し `dist` と一致
- AC-03: invalidation完了待機を通過し、配信更新完了条件を満たす
- AC-04: バケット未設定/不正時に同期で失敗し後続停止
- AC-05: Distribution ID未設定/不正時にinvalidationで失敗
- AC-06: 失敗時サマリーに失敗ステップ/run URL/復旧導線を出力
- AC-07: `rollback_run_id` 指定でartifactから復元実行可能
- AC-08: 大量不要ファイル時にも同期が完了できる設計（`--delete` 要件を担保）
- AC-09: 同日複数デプロイで独立判定可能（concurrency設定で担保）
- AC-10: 手動再実行で同一入力時に冪等実行可能

---

## 6. テスト設計（RED）

### 6.1 Static Test: `frontend/tests/workflow/deployFrontendS3CloudFrontWorkflow.red.test.ts`

- ST-01: ワークフローファイル存在
  - コメント: `// 何を検証するか: deploy-frontend.yml が規定パスに存在すること`
- ST-02: 必須ステップ名の存在
  - コメント: `// 何を検証するか: S3同期・invalidation・失敗サマリー・artifact保存の各ステップが定義されていること`
- ST-03: S3同期コマンド要件
  - コメント: `// 何を検証するか: aws s3 sync が dist を同期し --delete と --exact-timestamps を指定していること`
- ST-04: invalidation作成/完了待機の順序
  - コメント: `// 何を検証するか: create-invalidation の後に wait invalidation-completed が定義されていること`
- ST-05: 失敗時サマリー条件
  - コメント: `// 何を検証するか: Publish failure summary が if: failure() 条件で実行されること`
- ST-06: artifact保存定義
  - コメント: `// 何を検証するか: frontend-dist artifact が30日保持で保存されること`
- ST-07: rollback入力定義
  - コメント: `// 何を検証するか: workflow_dispatch.inputs に rollback_run_id が定義されていること`
- ST-08: concurrency定義
  - コメント: `// 何を検証するか: concurrency.group と cancel-in-progress=false が設定されていること`

### 6.2 Static Test: `frontend/tests/workflow/deployFrontendS3CloudFrontDocs.red.test.ts`

- SD-01: ドキュメントファイル存在
  - コメント: `// 何を検証するか: docs/deploy/frontend.md が存在すること`
- SD-02: ロールバック手順記載
  - コメント: `// 何を検証するか: rollback_run_id を使ったartifact復元手順が記載されていること`
- SD-03: IAM最小権限記載
  - コメント: `// 何を検証するか: s3/cloudfront の最小権限一覧が明記されていること`

### 6.3 Simulated Runtime Test: `frontend/tests/workflow/deployFrontendS3CloudFrontRuntime.red.test.ts`

- RT-01: バケット未設定時の停止
  - コメント: `// 何を検証するか: S3_BUCKET_FRONTEND 未設定時に Sync assets to S3 で停止し後続へ進まないこと`
- RT-02: Distribution ID不正時の停止
  - コメント: `// 何を検証するか: CLOUDFRONT_DISTRIBUTION_ID 不正時に invalidation関連ステップで停止すること`
- RT-03: wait失敗時のジョブ失敗
  - コメント: `// 何を検証するか: invalidation完了待機が失敗した場合にジョブ全体を失敗扱いにすること`
- RT-04: 同一rollback入力での冪等実行
  - コメント: `// 何を検証するか: 同じ rollback_run_id で2回実行しても同一コマンド列で再同期されること`

注記:
- 現時点では対象ワークフローとドキュメントが未作成のため、REDは複数テスト失敗で成立する

---

## 7. AC-IDとテストID対応表

- AC-01: ST-02, ST-03, ST-04
- AC-02: ST-03, RT-01
- AC-03: ST-04, RT-03
- AC-04: RT-01
- AC-05: RT-02, RT-03
- AC-06: ST-05
- AC-07: ST-07, SD-02
- AC-08: ST-03
- AC-09: ST-08
- AC-10: ST-07, RT-04

---

## 8. 実装ルール（テストコード規約）

- 各 `it` の直前に `何を検証するか` コメントを日本語で記述する
- テスト名は日本語で期待動作を明示する
- YAMLは構造パースで検証する（文字列grepのみを禁止）
- 失敗メッセージに不足キー名・不足ステップ名を含める
- RED段階では外部ネットワークに依存するテストを作成しない

---

## 9. RED実行手順

`frontend` で実行:

1. 依存インストール
   - `npm ci`
2. 静的REDテスト
   - `npx vitest run tests/workflow/deployFrontendS3CloudFrontWorkflow.red.test.ts tests/workflow/deployFrontendS3CloudFrontDocs.red.test.ts`
3. 擬似実行REDテスト
   - `npx vitest run tests/workflow/deployFrontendS3CloudFrontRuntime.red.test.ts`

証跡:

- 初回実行でAC対応テストが5件以上失敗すること
- 失敗理由が仕様未実装/不一致であること
- 環境起因失敗が0件であること

---

## 10. 完了条件（RED）

- ACをカバーするREDテスト計画が作成されている
- すべてのテストに `何を検証するか` コメントが付与される規約が明記されている
- RED実行で有効な失敗（仕様未実装/不一致）が確認できる
- 無効失敗（構文/環境起因）が0件である

---

## 11. コミット方針

コミットメッセージ（Issue番号必須）:

`test: E14-02 REDテスト計画を追加 #67`

コミット本文（例）:

- E14-03/E14-04/E14-06のACをRED観点へ分解
- ワークフロー・ドキュメント・擬似実行のREDテスト計画を追加
- 各テストに「何を検証するか」コメント必須ルールを明記

補足:

- 分割コミット時も、すべてのコミットタイトル末尾に `#67` を付与する

---

## 12. 運用

- 本計画の正本: `.github/E14-02_FRONTEND_AUTO_DEPLOY_S3_CLOUDFRONT_RED_TEST_PLAN.md`
- レビュー反映時は本ファイルを上書き更新する
- 対象Issue: `#67`
```
