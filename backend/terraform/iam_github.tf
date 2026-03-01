# =============================================================================
# GitHub OIDC Integration
# =============================================================================

# GitHub OIDC Provider
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_caller_identity" "current" {}

locals {
  frontend_deploy_subs    = formatlist("repo:%s:ref:%s", var.github_repository, var.frontend_deploy_ref_patterns)
  backend_deploy_subs     = formatlist("repo:%s:ref:%s", var.github_repository, var.backend_deploy_ref_patterns)
  cloudfront_distribution = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${var.cloudfront_distribution_id}"
}

# GitHub Actions用IAMロール（フロントデプロイ）
resource "aws_iam_role" "frontend_github_actions" {
  name        = "github-actions-frontend-deploy-role"
  description = "Role for GitHub Actions frontend deploy (S3 + CloudFront)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" : "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" : local.frontend_deploy_subs
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "frontend_github_actions" {
  name = "github-actions-frontend-deploy-policy"
  role = aws_iam_role.frontend_github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3ListBucket"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = "arn:aws:s3:::${var.frontend_s3_bucket_name}"
      },
      {
        Sid    = "S3ObjectRW"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.frontend_s3_bucket_name}/*"
      },
      {
        Sid    = "CloudFrontDeployOps"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetInvalidation"
        ]
        Resource = local.cloudfront_distribution
      }
    ]
  })
}

resource "aws_iam_role_policies_exclusive" "frontend_github_actions" {
  role_name    = aws_iam_role.frontend_github_actions.name
  policy_names = [aws_iam_role_policy.frontend_github_actions.name]
}

# GitHub Actions用IAMロール（バックエンドデプロイ）
resource "aws_iam_role" "backend_github_actions" {
  name = "github-actions-backend-deploy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" : "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" : local.backend_deploy_subs
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "backend_github_actions" {
  name = "github-actions-backend-deploy-inline"
  role = aws_iam_role.backend_github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowECRAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = aws_ecr_repository.app.arn
      },
      {
        Sid    = "AllowLambdaUpdate"
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration"
        ]
        Resource = aws_lambda_function.app.arn
      }
    ]
  })
}

resource "aws_iam_role_policies_exclusive" "backend_github_actions" {
  role_name    = aws_iam_role.backend_github_actions.name
  policy_names = [aws_iam_role_policy.backend_github_actions.name]
}
