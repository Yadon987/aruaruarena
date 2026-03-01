# フロントエンドデプロイ設定

このドキュメントは `deploy-frontend` ワークフローの最小設定手順です。

## 必須設定

ワークフローで実際に参照する値です。

- Secret: `AWS_ROLE_ARN_FRONTEND_DEPLOY`（`vars` フォールバック可）
- Variable: `AWS_REGION`（未設定時は `Secret: AWS_REGION`、それも未設定なら `ap-northeast-1` を使用）
- Variable: `S3_BUCKET_FRONTEND`（`Secret` フォールバック可）
- Variable: `CLOUDFRONT_DISTRIBUTION_ID`（`Secret` フォールバック可）

## 実行可能ブランチ

- `push`: `main` のみ
- `workflow_dispatch`: `main` または `feature/*`

`workflow_dispatch` を `main` / `feature/*` 以外から実行すると、AWS 認証前の `Validate deploy branch` ステップで停止する。

## 運用前チェック（最小）

- `AWS_ROLE_ARN_FRONTEND_DEPLOY`、`AWS_REGION`、`S3_BUCKET_FRONTEND`、`CLOUDFRONT_DISTRIBUTION_ID` が設定済みであること
- `AWS_ROLE_ARN_FRONTEND_DEPLOY` は `github-actions-frontend-deploy-role` を指すこと
- `workflow_dispatch` で手動実行できること
- CloudFront の `Default root object` が `index.html` であること
- CloudFront の `Custom error response` で `403` と `404` を `200 /index.html` にフォールバックしていること（SPAルーティング向け。S3プライベートバケット運用では404相当が403になるため両方必要）
- `403 -> 200` は正規のアクセス拒否を隠す可能性があるため、適用前にバケットポリシーとWAFルールを確認すること
- CloudFront の Default behavior に Lambda@Edge (`origin-request`) が関連付いていること
- CloudFront の Default behavior で `User-Agent` を origin request policy 経由で転送していること（クローラー判定用）

## OGP本番確認

本番で OGP が正しく配信されるかは、API Gateway 直叩きと CloudFront 経由の両方を確認する。
OGP画像は投稿が `scored` になった時点（および再審査成功時）で事前生成され、frontend 用 S3 バケットの `ogp/posts/` 配下から CloudFront 経由で配信される。
実行前に `${API_GATEWAY_ENDPOINT}` と `${CLOUDFRONT_DOMAIN}` を対象環境の実値に置き換えること。

1. API Gateway がクローラー向け OGP HTML を返すことを確認する

```bash
curl -i -A "Twitterbot/1.0" \
  https://${API_GATEWAY_ENDPOINT}/api/posts/<POST_ID>
```

期待値:
- `HTTP/2 200`
- `content-type: text/html`
- `og:title`, `og:image`, `twitter:card` を含む

1. CloudFront 経由でクローラー向け OGP HTML が返ることを確認する

```bash
curl -i -A "Twitterbot/1.0" \
  https://${CLOUDFRONT_DOMAIN}/posts/<POST_ID>
```

期待値:
- `HTTP/2 200`
- `content-type: text/html`
- S3 の `index.html` ではなく、OGPメタタグ付きHTMLが返る

1. OGP画像 URL が PNG を返すことを確認する

```bash
curl -I \
  https://${CLOUDFRONT_DOMAIN}/ogp/posts/<POST_ID>.png
```

期待値:
- `HTTP/2 200`
- `content-type: image/png`
- `cache-control: max-age=604800, public`

1. 問題発生時の切り分け

```bash
# CloudFront は失敗し、API Gateway は成功する場合
# Lambda@Edge 関連付け、origin request policy、User-Agent 転送を確認する

# OGP画像だけ失敗する場合
# 1. S3 に PNG が存在するか確認する
# aws s3 ls s3://${S3_BUCKET_FRONTEND}/ogp/posts/<POST_ID>.png
# 2. 事前生成ログを確認する（CloudWatch Logs の /aws/lambda/<LAMBDA_NAME> を参照）
# 投稿審査（scored移行）または再審査時の UploadOgpImageService 実行ログを探す

# CloudFront / API Gateway の両方が失敗する場合
# Rails 側の OGP HTML 生成と投稿ステータス(scored)を確認する
```

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
