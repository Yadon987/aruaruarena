resource "aws_lambda_function" "app" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:latest"
  timeout       = 120
  memory_size   = 512



  environment {
    variables = {
      RAILS_ENV                  = "production"
      RAILS_SERVE_STATIC_FILES   = "true"
      RAILS_LOG_TO_STDOUT        = "true"
      RAILS_LOG_LEVEL            = "info" # debug -> info to save CloudWatch costs
      SECRET_KEY_BASE            = var.secret_key_base
      DYNAMODB_TABLE_POSTS       = aws_dynamodb_table.posts.name
      BASE_URL                   = var.base_url
      SECRETS_MANAGER_ENABLED    = var.secrets_manager_enabled ? "true" : "false"
      GEMINI_SECRET_ARN          = var.secrets_manager_enabled ? aws_secretsmanager_secret.gemini_api_key.arn : ""
      CEREBRAS_SECRET_ARN        = var.secrets_manager_enabled ? aws_secretsmanager_secret.cerebras_api_key.arn : ""
      GROQ_SECRET_ARN            = var.secrets_manager_enabled ? aws_secretsmanager_secret.groq_api_key.arn : ""
      GEMINI_API_KEY             = var.secrets_manager_enabled ? "" : var.gemini_api_key
      CEREBRAS_API_KEY           = var.secrets_manager_enabled ? "" : var.cerebras_api_key
      GROQ_API_KEY               = var.secrets_manager_enabled ? "" : var.groq_api_key
      SQS_QUEUE_URL              = aws_sqs_queue.judgment_queue.url
      OGP_S3_BUCKET              = var.frontend_s3_bucket_name
      CLOUDFRONT_DISTRIBUTION_ID = var.cloudfront_distribution_id
    }
  }

  # reserved_concurrent_executions = 10 # Disable due to account limit (10). This low limit itself acts as a safety guard.

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy,
    aws_ecr_repository.app,
    aws_cloudwatch_log_group.lambda
  ]
}

resource "aws_lambda_event_source_mapping" "judgment_queue" {
  event_source_arn                   = aws_sqs_queue.judgment_queue.arn
  function_name                      = aws_lambda_function.app.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0
}
