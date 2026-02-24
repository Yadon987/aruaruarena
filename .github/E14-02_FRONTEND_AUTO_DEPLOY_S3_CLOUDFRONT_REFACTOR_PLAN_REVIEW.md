- [重要度: 高]
- 問題点: エッジケース追加テストの「成功判定」が曖昧で、どのテストが既存仕様固定でどれが新規品質向上か区別されていない。
- 改善提案: テストID（RF-xx）を付与し、各IDを完了条件とACに紐づける。

- [重要度: 高]
- 問題点: `scripts/test_all.sh` 実行時に既存負債が混在した場合の終了条件が曖昧。
- 改善提案: 「E14-02差分起因の失敗が0件であること」を明示し、既存負債は記録のみでブロックしない運用を定義する。

- [重要度: 中]
- 問題点: セキュリティ観点が弱く、workflow権限逸脱（permissions追加）を防ぐ検証が明文化されていない。
- 改善提案: `permissions` 完全一致（`id-token: write`, `contents: read`）の固定テストをRefactor対象に含める。

- [重要度: 中]
- 問題点: コメント追加方針はあるが、どこに何を書くかが抽象的でレビュー時に判定しづらい。
- 改善提案: 対象行・対象ステップ（Wait invalidation / failure summary）を明示して判定可能にする。

- [重要度: 低]
- 問題点: DynamoDB観点は非対象だが、N/A明記がないためチェック観点との対応が弱い。
- 改善提案: 「CI/CDのみでDynamoDB変更なし（N/A）」を独立節で明記する。

完全版:

```md
# Refactor計画書（改訂版）: E14-02 S3同期とCloudFront invalidation

## 0. 目的

`.github/E14-02_FRONTEND_AUTO_DEPLOY_S3_CLOUDFRONT_GREEN_MIN_IMPLEMENTATION_PLAN.md` と Issue #67 を基準に、
Greenで通過している実装の振る舞いを変えずに、保守性・可読性・テスト網羅性を改善する。

---

## 1. 前提

- 既存テストは必ず継続パスを維持する
- 振る舞いは変更しない（内部実装のみ改善）
- 過剰な最適化は行わない
- エッジケースの追加は必要最小限に留める
- 変更対象は E14-02 関連ファイルに限定する

---

## 2. 対象ファイル

- `.github/workflows/deploy-frontend.yml`
- `docs/deploy/frontend.md`
- `frontend/tests/workflow/helpers/workflowTestUtils.ts`
- `frontend/tests/workflow/deployFrontendS3CloudFront*.red.test.ts`
- 必要に応じて `frontend/tests/workflow/deployFrontendS3CloudFront*.refactor.test.ts`（新規）

---

## 3. Refactor観点

### 3.1 エッジケース追加テスト

追加するテストID（最小）:
- RF-01: `workflow_dispatch.inputs.rollback_run_id` の型（string）・required（false）を検証
- RF-02: `concurrency.group` と `cancel-in-progress: false` を検証
- RF-03: `permissions` が `id-token: write` / `contents: read` の完全一致であることを検証
- RF-04: `Publish failure summary` の `run` が `GITHUB_STEP_SUMMARY` と run URL を含むことを検証
- RF-05: `docs/deploy/frontend.md` が Issue1必須値（`AWS_ROLE_ARN_FRONTEND_DEPLOY`, `AWS_REGION`）を維持しつつ、Issue2追記（`rollback_run_id`, `frontend-dist`, IAM最小権限）を含むことを検証

### 3.2 コード改善

- マジック文字列の定数化
  - step名、主要コマンド断片、ドキュメント必須キーを `workflowTestUtils.ts` に集約
- 可読性向上
  - workflowテストの共通前処理（ファイル存在チェック、workflowロード）を関数化
  - アサーションの重複除去
- 不要処理削除
  - 重複存在チェックや重複定義の削除
  - 未使用定数・未使用ヘルパーの整理

### 3.3 コメント追加

- `.github/workflows/deploy-frontend.yml`
  - `Wait CloudFront invalidation completed` に「プレースホルダIDでの最小実装」意図を日本語コメントで明示
  - `Publish failure summary` に「障害時の初動導線を残す目的」を日本語コメントで明示
- workflowテスト
  - 厳密比較（permissions完全一致、concurrency固定）を行う理由を日本語コメントで明示

---

## 4. 実施手順

1. 現行REDテストと既存workflowテストが通る状態を起点として確認
2. RF-01〜RF-05 のエッジケーステストを先に追加し、失敗を確認（Red）
3. 既存挙動を変えない範囲で最小修正してテストを通す（Green）
4. `workflowTestUtils.ts` へ定数・共通関数を集約して重複を除去（Refactor）
5. `deploy-frontend.yml` / テストコードへ日本語コメントを追記
6. 既存・追加テストの再実行で回帰がないことを確認
7. `scripts/test_all.sh` を実行し、失敗ログを分類する
8. E14-02差分起因の失敗のみ修正し、再実行で解消を確認

---

## 5. 確認コマンド

優先順:
1. `cd frontend && npx vitest run tests/workflow/deployFrontendS3CloudFront*.red.test.ts`
2. `cd frontend && npx vitest run tests/workflow/*.test.ts`
3. `bash scripts/test_all.sh`

失敗時の対応:
- workflowテスト失敗: E14-02変更箇所の定数・期待値を修正
- `scripts/test_all.sh` 失敗:
  - E14-02差分起因なら修正対象
  - 既存負債起因ならログ記録して本Issueでは非ブロッキング

---

## 6. 完了条件

- 既存テスト + RF-01〜RF-05 がすべてパスする
- 振る舞い差分がない（ワークフローの外部仕様を変更しない）
- マジック文字列の重複が減り、主要定義が共通化されている
- 指定箇所に日本語コメントが追加されている
- `scripts/test_all.sh` 実行後、E14-02差分起因の失敗が0件である

---

## 7. 非スコープ

- E14-02以外の画面機能・API機能の改修
- AWS実環境でのデプロイ疎通確認
- CloudFront invalidation ID取得ロジックの本格実装
- 大規模なテスト基盤刷新

---

## 8. DynamoDB観点

- 本IssueはCI/CDと関連テストのみ
- DynamoDBのTable/PK/SK/GSI変更はすべてN/A

---

## 9. コミットメッセージ案（CLAUDE.md準拠）

- `refactor: E14-02 ワークフローとテスト可読性を改善 #67`

本文例:
- RF-01〜RF-05 のエッジケース検証テストを追加
- workflowテストの定数化と重複除去
- Wait invalidation/failure summaryへ日本語コメントを追加
- `scripts/test_all.sh` 実行結果を確認しE14-02差分起因を解消

---

## 10. 運用

- 本計画の正本: `.github/E14-02_FRONTEND_AUTO_DEPLOY_S3_CLOUDFRONT_REFACTOR_PLAN.md`
- レビュー反映時は本ファイルを上書き更新する
```
