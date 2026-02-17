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

## ロールバック手順（Issue 2最小版）

1. `workflow_dispatch` 実行時に `rollback_run_id` を指定する
2. `frontend-dist` artifact を取得して展開する
3. 以下コマンドでS3へ再同期する
   - `aws s3 sync dist s3://$S3_BUCKET_FRONTEND --delete --exact-timestamps`
4. CloudFrontキャッシュを無効化する
   - `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'`

## IAM最小権限（Issue 2）

- `s3:ListBucket`
- `s3:PutObject`
- `s3:DeleteObject`
- `cloudfront:CreateInvalidation`
- `cloudfront:GetInvalidation`
