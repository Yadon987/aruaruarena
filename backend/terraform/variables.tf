variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "aruaruarena"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "ecr_repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "aruaruarena-backend"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "aruaruarena-rails"
}

variable "secret_key_base" {
  description = "Rails secret key base"
  type        = string
  sensitive   = true
}

variable "base_url" {
  description = "Base URL for the application (e.g. CloudFront URL)"
  type        = string
  default     = "https://dzt7yd2jha9r3.cloudfront.net"
}

variable "gemini_api_key" {
  description = "Gemini API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cerebras_api_key" {
  description = "Cerebras API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "groq_api_key" {
  description = "Groq API key"
  type        = string
  sensitive   = true
  default     = ""
}
