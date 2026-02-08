resource "aws_lambda_function" "app" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:latest"
  timeout       = 30
  memory_size   = 512



  environment {
    variables = {
      RAILS_ENV             = "production"
      RAILS_SERVE_STATIC_FILES = "true"
      RAILS_LOG_TO_STDOUT   = "info" # debug -> info to save CloudWatch costs
      SECRET_KEY_BASE       = var.secret_key_base
      DYNAMODB_TABLE_POSTS  = aws_dynamodb_table.posts.name
    }
  }

  # reserved_concurrent_executions = 10 # Disable due to account limit (10). This low limit itself acts as a safety guard.

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy,
    aws_ecr_repository.app,
    aws_cloudwatch_log_group.lambda
  ]
}
