# フロントエンドデプロイ設定

このドキュメントは `deploy-frontend` ワークフローの最小設定手順です。

## 必須設定

ワークフローで実際に参照する値です。

- Secret: `AWS_ROLE_ARN_FRONTEND_DEPLOY`（`vars` フォールバック可）
- Variable: `AWS_REGION`（未設定時は `Secret: AWS_REGION`、それも未設定なら `ap-northeast-1` を使用）
- Variable: `S3_BUCKET_FRONTEND`（`Secret` フォールバック可）
- Variable: `CLOUDFRONT_DISTRIBUTION_ID`（`Secret` フォールバック可）

## 運用前チェック（最小）

- `AWS_ROLE_ARN_FRONTEND_DEPLOY`、`AWS_REGION`、`S3_BUCKET_FRONTEND`、`CLOUDFRONT_DISTRIBUTION_ID` が設定済みであること
- `workflow_dispatch` で手動実行できること
- CloudFront の `Default root object` が `index.html` であること
- CloudFront の `Custom error response` で `403` と `404` を `200 /index.html` にフォールバックしていること（SPAルーティング向け。S3プライベートバケット運用では404相当が403になるため両方必要）
- `403 -> 200` は正規のアクセス拒否を隠す可能性があるため、適用前にバケットポリシーとWAFルールを確認すること

## ロールバック手順

1. `workflow_dispatch` 実行時に `rollback_run_id` を指定する
2. `frontend-dist` artifact を取得して展開する
3. 以下コマンドでS3へ再同期する
   - `aws s3 sync dist s3://$S3_BUCKET_FRONTEND --delete --exact-timestamps`
4. CloudFrontキャッシュを無効化する
   - `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'`

## IAM最小権限

- `s3:ListBucket`
- `s3:PutObject`
- `s3:DeleteObject`
- `cloudfront:CreateInvalidation`
- `cloudfront:GetDistribution`
- `cloudfront:GetInvalidation`
