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
output "github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions."
  value       = aws_iam_role.github_actions.arn
}
