# Gemini API Key Secret
resource "aws_secretsmanager_secret" "gemini_api_key" {
  name                    = "${var.project_name}/ai-keys/gemini-${var.environment}"
  description             = "Gemini API Key for ${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "gemini"
  }
}

# Cerebras API Key Secret
resource "aws_secretsmanager_secret" "cerebras_api_key" {
  name                    = "${var.project_name}/ai-keys/cerebras-${var.environment}"
  description             = "Cerebras API Key for ${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "cerebras"
  }
}

# Groq API Key Secret
resource "aws_secretsmanager_secret" "groq_api_key" {
  name                    = "${var.project_name}/ai-keys/groq-${var.environment}"
  description             = "Groq API Key for ${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "groq"
  }
}
