resource "aws_iam_role" "lambda_exec" {
  name = "serverless_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb_access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.posts.arn,
          aws_dynamodb_table.judgments.arn,
          aws_dynamodb_table.rate_limits.arn,
          aws_dynamodb_table.duplicate_checks.arn,
          "${aws_dynamodb_table.posts.arn}/index/*",
          "${aws_dynamodb_table.judgments.arn}/index/*",
          "${aws_dynamodb_table.rate_limits.arn}/index/*",
          "${aws_dynamodb_table.duplicate_checks.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:ListTables"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "sqs_access" {
  name = "sqs_access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.judgment_queue.arn,
          aws_sqs_queue.judgment_dlq.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "s3_ogp_access" {
  name = "s3_ogp_access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${var.frontend_s3_bucket_name}/ogp/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "cloudfront_ogp_invalidation" {
  name = "cloudfront_ogp_invalidation"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation"
        ]
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${var.cloudfront_distribution_id}"
      }
    ]
  })
}

# =============================================================================
# Lambda@Edge用IAMロール（OGPメタタグ配信用）
# =============================================================================

resource "aws_iam_role" "lambda_edge_ogp" {
  name = "${var.project_name}-lambda-edge-ogp"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_edge_ogp_basic" {
  role       = aws_iam_role.lambda_edge_ogp.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
