---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E19 S3 + CloudFront Terraform追加'
labels: 'spec, terraform, infrastructure'
assignees: ''
---

## 📋 概要

フロントエンド配信用のS3バケットとCloudFrontディストリビューションをTerraformでコード化し、インフラをIaC管理する。

現在、`deploy-frontend.yml` で使用しているS3バケットとCloudFrontディストリビューションは手動作成されており、Terraform管理されていない。これをTerraformで管理することで、インフラの再現性、変更履歴の追跡、環境の一貫性を確保する。

## 🎯 目的

- インフラをコード化（IaC）し、再現性と変更履歴の追跡を可能にする
- GitHub Actions用IAMロールにS3/CloudFront権限を付与し、デプロイを自動化
- 手動設定による設定ミスや環境差異を防止

---

## 📝 詳細仕様

### 前提条件

- **既存リソースの扱い**: 新規作成後に切り替え
  - 手動作成済みのS3バケットとCloudFrontは、Terraformで新規作成したリソースに切り替える
  - 切り替え手順は別途ドキュメント化（`docs/migration/frontend-s3-cloudfront.md`）
  - **インポートは行わない**（既存設定の完全な再現が困難なため）

### 機能要件

- S3バケットの作成（静的ウェブサイトホスティング用）
- CloudFrontディストリビューションの作成（S3オリジン）
- Origin Access Control (OAC) の設定（S3への直接アクセスを禁止）
- カスタムエラーページの設定（403/404 → index.html、SPAルーティング対応）
- バージョニングの有効化
- サーバーサイド暗号化（SSE-S3）の設定
- GitHub Actions用IAMロールへのS3/CloudFront権限付与（最小権限）
- TerraformアウトプットにS3バケット名とCloudFrontディストリビューションIDを追加

### 非機能要件

- **セキュリティ**:
  - S3パブリックアクセスブロック
  - OACによるアクセス制御
  - TLS 1.2以上
  - サーバーサイド暗号化（SSE-S3）
- **パフォーマンス**:
  - CloudFrontキャッシュ（default_ttl: 3600, max_ttl: 86400）
  - Gzip圧縮有効
- **可用性**: CloudFrontのマルリージョン冗長性
- **コスト**: オンデマンド課金、アクセスログは無効（コスト削減）

### UI/UX設計

N/A（インフラ設定）

---

## 🔧 技術仕様

### データモデル (DynamoDB)

N/A（インフラ設定）

### API設計

N/A（インフラ設定）

### Terraformリソース設計

#### 新規ファイル: `backend/terraform/s3.tf`

```hcl
# フロントエンド用S3バケット
resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "aruaruarena-frontend-"
  force_destroy = false # 本番環境では誤削除防止のためfalse

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# バージョニング設定
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

# 静的ウェブサイト設定（CloudFront経由のみアクセス）
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # SPAルーティング対応
  }
}

# パブリックアクセスブロック
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# サーバーサイド暗号化設定
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudFront専用アクセスポリシー
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFront"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}
```

#### 新規ファイル: `backend/terraform/cloudfront.tf`

```hcl
# Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "aruaruarena-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFrontディストリビューション
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  http_version        = "http2"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"
    compress         = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # SPAルーティング対応（403/404 → index.html）
  custom_error_response {
    error_code            = 403
    error_caching_min_ttl = 10
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_code            = 404
    error_caching_min_ttl = 10
    response_code         = 200
    response_page_path    = "/index.html"
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

#### 更新ファイル: `backend/terraform/iam.tf`

```hcl
# 既存のdeploy_policyに追加
resource "aws_iam_role_policy" "deploy_policy" {
  # 既存の定義に以下のStatementを追加
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 既存のECR/Lambda権限...
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.frontend.arn,
          "${aws_s3_bucket.frontend.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations"
        ]
        Resource = "*"
      }
    ]
  })
}
```

#### 更新ファイル: `backend/terraform/outputs.tf`

```hcl
# 既存のアウトプットに追加

output "frontend_s3_bucket_name" {
  description = "Name of the frontend S3 bucket."
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution."
  value       = aws_cloudfront_distribution.frontend.domain_name
}
```

### GitHub Actions変数の設定

`terraform apply` 完了後、以下のGitHub Variables/Secretsを更新する：

| 変数名 | 設定値 | 取得方法 |
|--------|--------|----------|
| `S3_BUCKET_FRONTEND` | S3バケット名 | `terraform output -raw frontend_s3_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | ディストリビューションID | `terraform output -raw cloudfront_distribution_id` |

---

## 🧪 テスト計画 (TDD)

### Terraformバリデーション

- [ ] `terraform fmt -check` でフォーマット確認
- [ ] `terraform validate` で構文チェック
- [ ] `terraform plan` で変更内容を確認

### インフラテスト

- [ ] `terraform apply` でリソース作成
- [ ] S3バケットへのファイルアップロード確認（AWS CLI）
- [ ] CloudFront経由でのアクセス確認（curl）
- [ ] S3直接アクセスが拒否されることを確認（403）
- [ ] SPAルーティングの動作確認（`/posts/123` 等の直接アクセス）
- [ ] GitHub Actionsからのデプロイ確認
- [ ] `terraform destroy` でリソース削除確認（検証環境のみ）

### 統合テスト

- [ ] 検証環境でE2Eテスト実行
- [ ] 本番環境切り替え後の動作確認

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** Terraformが初期化されている
      **When** `terraform apply` を実行
      **Then** S3バケットとCloudFrontディストリビューションが作成される

- [ ] **Given** S3バケットとCloudFrontが作成されている
      **When** CloudFrontのURLにアクセス
      **Then** フロントエンドのコンテンツが表示される

- [ ] **Given** GitHub Actionsが設定されている
      **When** mainブランチにマージ
      **Then** S3にデプロイされ、CloudFrontのキャッシュがクリアされる

- [ ] **Given** SPAのルート（例: `/posts/123`）に直接アクセス
      **When** URLをブラウザで開く
      **Then** index.htmlが返され、React Routerが正しく動作する

### 異常系 (Error Path)

- [ ] **Given** S3バケットが存在する
      **When** S3のURLに直接アクセス
      **Then** 403 Access Deniedが返される

- [ ] **Given** Terraformの状態が壊れている
      **When** `terraform apply` を実行
      **Then** 適切なエラーメッセージが表示される

### 境界値 (Edge Case)

- [ ] **Given** 大きなファイル（10MB以上）をアップロード
      **When** S3にアップロード
      **Then** マルチパートアップロードで成功する

- [ ] **Given** 同時に複数のデプロイが実行される
      **When** GitHub Actionsが並列実行
      **Then** concurrency設定により後のデプロイが待機またはキャンセルされる

---

## 🔗 関連資料

- [Terraform AWS S3 Bucket](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket)
- [Terraform AWS CloudFront Distribution](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution)
- [AWS CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- `docs/completion_roadmap.md` 2. S3 + CloudFront（Terraform追加）
- `.github/workflows/deploy-frontend.yml` 既存のデプロイワークフロー

---

## 📁 作成・更新ファイル一覧

### 新規作成

| ファイル | 説明 |
|----------|------|
| `backend/terraform/s3.tf` | S3バケット関連リソース |
| `backend/terraform/cloudfront.tf` | CloudFront関連リソース |

### 更新

| ファイル | 変更内容 |
|----------|----------|
| `backend/terraform/iam.tf` | S3/CloudFront権限の追加 |
| `backend/terraform/outputs.tf` | S3/CloudFrontアウトプットの追加 |

---

## ⚠️ 注意事項

- **既存リソースとの切り替え**: 本Issue完了後、既存の手動作成リソースから新規Terraform管理リソースへの切り替えが必要
- **force_destroy = false**: 本番環境では誤削除防止のため、S3バケットの中身があっても削除できない設定
- **アクセスログ無効**: コスト削減のためCloudFrontアクセスログは無効化。必要に応じて後で有効化可能
- **CloudFront invalidation制限**: `/*` で全キャッシュクリア。1回のinvalidationで3,000パスまでという制限があるが、現状問題なし

---

**レビュアーへの確認事項:**

- [ ] S3バケット名の命名規則は適切か（`bucket_prefix` 使用で一意性確保）
- [ ] CloudFrontのキャッシュ設定は適切か
- [ ] IAM権限は最小権限の原則に従っているか（特定バケットのみ）
- [ ] SPAルーティング対応のカスタムエラーレスポンス設定が適切か
- [ ] `deploy-frontend.yml` の変数とTerraformアウトプットの連携方法が明確か
