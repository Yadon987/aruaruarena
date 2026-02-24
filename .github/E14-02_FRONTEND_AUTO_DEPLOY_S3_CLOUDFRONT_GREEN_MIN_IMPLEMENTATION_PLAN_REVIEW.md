- [重要度: 高]
- 問題点: `Wait CloudFront invalidation completed` の `--id <invalidation_id>` は実運用で未解決だが、最小実装として「どう置くか」が計画上曖昧。
- 改善提案: このフェーズはテスト通過優先で、`<invalidation_id>` は固定プレースホルダ（マジック値）で許容する方針を明記する。

- [重要度: 高]
- 問題点: `Publish failure summary` の出力内容が抽象的で、REDテストが要求する `GITHUB_STEP_SUMMARY` 文字列が欠落するリスクがある。
- 改善提案: `run` 内で `GITHUB_STEP_SUMMARY` へ追記する実装を必須項目として明示する。

- [重要度: 中]
- 問題点: `workflow_dispatch` への `inputs.rollback_run_id` 追加時に既存トリガー互換性を保つ条件が明記されていない。
- 改善提案: `workflow_dispatch` をオブジェクト形式へ拡張し、既存の手動実行を維持することを追記する。

- [重要度: 中]
- 問題点: ドキュメント更新で既存Issue1内容を保持する方針がなく、既存テスト回帰のリスクがある。
- 改善提案: `AWS_ROLE_ARN_FRONTEND_DEPLOY` / `AWS_REGION` / 予約設定値の既存記載を消さずに追記のみ行うことを明記する。

- [重要度: 低]
- 問題点: 検証コマンドがREDテスト3本のみで、実装ファイルの構文破壊（YAML不正）に対する明示的な確認が弱い。
- 改善提案: 最小限として `vitest` 実行を必須にしつつ、失敗時は最初にYAMLパースエラー有無を確認する運用注意を追記する。

完全版:

```md
# GREEN最小実装計画（改訂版）: E14-02 S3同期とCloudFront invalidation

## 0. 目的

`.github/E14-02_FRONTEND_AUTO_DEPLOY_S3_CLOUDFRONT_RED_TEST_PLAN.md` と Issue #67 の受入条件を満たすため、
現在失敗しているREDテストをパスさせる最小限の実装のみを行う。

---

## 1. 重要な制約

- テストをパスする最小限のコードのみ実装する
- 過剰な最適化は行わない（Refactorフェーズで実施）
- エッジケースの追加実装は今回行わない
- マジックナンバーや固定値はこの段階では許容する
- 既存のE14-01要件を壊す変更をしない

---

## 2. Green完了判定（対象REDテスト）

以下3ファイルのREDテストがすべて通過すること:

- `frontend/tests/workflow/deployFrontendS3CloudFrontWorkflow.red.test.ts`
- `frontend/tests/workflow/deployFrontendS3CloudFrontDocs.red.test.ts`
- `frontend/tests/workflow/deployFrontendS3CloudFrontRuntime.red.test.ts`

---

## 3. ACトレース（Issue #67 / エッジケース除外）

- AC-01: build後にS3同期し、CloudFront invalidation作成と完了待機まで定義される
- AC-02: `aws s3 sync ... --delete --exact-timestamps` が定義される
- AC-04: `S3_BUCKET_FRONTEND` 参照の同期ステップが失敗停止設定（`continue-on-error` 未使用）
- AC-05: `CLOUDFRONT_DISTRIBUTION_ID` 参照のinvalidation関連ステップが失敗停止設定（`continue-on-error` 未使用）
- AC-06: `if: failure()` でジョブサマリー出力ステップが定義される
- AC-07: `workflow_dispatch.inputs.rollback_run_id` と `frontend-dist` artifact保存定義が存在する

補足:
- AC-03（最新画面取得の実確認）と境界値AC（大量ファイル、多重実行、冪等性の実測）は今回の最小実装では対象外

---

## 4. 最小実装スコープ

### 4.1 ワークフロー更新

対象:
- `.github/workflows/deploy-frontend.yml`（更新）

追加/更新内容（最小）:
- `workflow_dispatch` をオブジェクト形式へ拡張し、`inputs.rollback_run_id` を追加する（手動実行トリガーは維持）
- `Build frontend` の直後に `Verify dist directory` を追加
  - `working-directory: ./frontend`
  - `run: test -d dist`
- `Sync assets to S3` を追加
  - `working-directory: ./frontend`
  - `run: aws s3 sync dist s3://$S3_BUCKET_FRONTEND --delete --exact-timestamps`
- `Create CloudFront invalidation` を追加
  - `run` に `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'`
- `Wait CloudFront invalidation completed` を追加
  - `run` に `aws cloudfront wait invalidation-completed --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --id <invalidation_id>`
  - `<invalidation_id>` はこのフェーズでは固定プレースホルダ（マジック値）を許容する
- `Publish failure summary` を追加
  - `if: failure()`
  - `run` で `GITHUB_STEP_SUMMARY` に失敗ステップ名・run URL・復旧導線を追記する
- `Upload deploy artifact` を追加
  - `uses: actions/upload-artifact@v4`
  - `with.name: frontend-dist`
  - `with.path: frontend/dist`
  - `with.retention-days: 30`
- 追加ステップでは `continue-on-error` を設定しない

### 4.2 ドキュメント更新

対象:
- `docs/deploy/frontend.md`（更新）

追加内容（最小）:
- 既存のIssue1内容（`AWS_ROLE_ARN_FRONTEND_DEPLOY`, `AWS_REGION`, 予約設定値）を保持し、追記のみ行う
- `rollback_run_id` を使った復旧手順
- `frontend-dist` artifactを使った再同期手順
- `aws s3 sync` と `aws cloudfront create-invalidation` の復旧コマンド例
- IAM最小権限の記載
  - `s3:ListBucket`
  - `s3:PutObject`
  - `s3:DeleteObject`
  - `cloudfront:CreateInvalidation`
  - `cloudfront:GetInvalidation`

---

## 5. 非スコープ（今回やらないこと）

- invalidation IDの厳密取得ロジック最適化
- Slack等の外部通知連携
- 実AWS環境での疎通検証
- 実ブラウザでの最新画面確認
- エッジケース向けの追加実装（大量不要ファイル、多重実行、冪等性の深掘り）

---

## 6. 変更対象ファイル

- `.github/workflows/deploy-frontend.yml`
- `docs/deploy/frontend.md`

---

## 7. 実装手順（順序固定）

1. `.github/workflows/deploy-frontend.yml` の `workflow_dispatch` をオブジェクト化し `inputs.rollback_run_id` を追加
2. `Verify dist directory` を `Build frontend` 後に追加
3. `Sync assets to S3` を追加
4. `Create CloudFront invalidation` と `Wait CloudFront invalidation completed` を順に追加
5. `Publish failure summary`（`if: failure()` + `GITHUB_STEP_SUMMARY`追記）を追加
6. `Upload deploy artifact`（`frontend-dist`, `retention-days: 30`）を追加
7. `docs/deploy/frontend.md` にロールバック手順とIAM最小権限を追記（既存記載は保持）
8. REDテスト3ファイルを実行し、すべて成功を確認

---

## 8. 検証手順

`frontend` で実行:

- `npx vitest run tests/workflow/deployFrontendS3CloudFrontWorkflow.red.test.ts tests/workflow/deployFrontendS3CloudFrontDocs.red.test.ts tests/workflow/deployFrontendS3CloudFrontRuntime.red.test.ts`

判定:
- 上記3ファイルがすべて成功したらGreen完了
- 失敗時はまずYAMLパースエラーの有無を確認し、構文問題を先に解消する

---

## 9. コミット方針

- `feat: E14-02 S3/CloudFront最小実装でREDを解消 #67`

---

## 10. 運用

- 本計画の正本: `.github/E14-02_FRONTEND_AUTO_DEPLOY_S3_CLOUDFRONT_GREEN_MIN_IMPLEMENTATION_PLAN.md`
- レビュー反映時は本ファイルを上書き更新する
```
