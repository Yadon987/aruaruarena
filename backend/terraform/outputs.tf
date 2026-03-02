output "api_gateway_endpoint" {
  description = "Base URL for API Gateway stage."
  value       = aws_apigatewayv2_stage.lambda.invoke_url
}

output "ecr_repository_url" {
  description = "URL of the ECR repository."
  value       = aws_ecr_repository.app.repository_url
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function."
  value       = aws_lambda_function.app.arn
}
output "frontend_github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions frontend deploy."
  value       = aws_iam_role.frontend_github_actions.arn
}

output "backend_github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions backend deploy."
  value       = aws_iam_role.backend_github_actions.arn
}

output "cloudfront_domain_name" {
  description = "Domain name of the frontend CloudFront distribution."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "access_log_bucket_name" {
  description = "S3 bucket name storing CloudFront and frontend S3 access logs."
  value       = aws_s3_bucket.access_logs.bucket
}
