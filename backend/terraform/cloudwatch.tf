resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 7 # Prevent unbounded log storage costs

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
