# =============================================================================
# EventBridge (Lambda Warmup)
# =============================================================================

resource "aws_cloudwatch_event_rule" "warmup" {
  name                = "${var.project_name}-warmup-${var.environment}"
  description         = "Ping Lambda every 5 minutes to keep it warm"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_event_target" "warmup_lambda" {
  rule      = aws_cloudwatch_event_rule.warmup.name
  target_id = "WarmupLambda"
  arn       = aws_lambda_function.app.arn

  # ウォームアップリクエストを識別するペイロード
  input = jsonencode({
    "source" : "warmup",
    "detail-type" : "scheduled-event"
  })
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.warmup.arn
}
