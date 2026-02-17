# フロントエンドデプロイ設定（E14-01）

このドキュメントは `deploy-frontend` ワークフローの最小設定手順です。

## 必須設定（Issue 1）

Issue 1で実際にワークフローが参照する値です。

- Secret: `AWS_ROLE_ARN_FRONTEND_DEPLOY`
- Variable: `AWS_REGION`

## 予約設定（Issue 2で必須化）

Issue 1では未使用ですが、Issue 2の本実装で必須化する予定です。

- VariableまたはSecret: `S3_BUCKET_FRONTEND`
- VariableまたはSecret: `CLOUDFRONT_DISTRIBUTION_ID`

## 運用前チェック（最小）

- `AWS_ROLE_ARN_FRONTEND_DEPLOY` と `AWS_REGION` が設定済みであること
- `workflow_dispatch` で手動実行できること

## 補足

- S3同期とCloudFront invalidationの本実装は Issue 2 で追加します。
