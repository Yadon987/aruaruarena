resource "aws_sqs_queue" "judgment_dlq" {
  name                      = "${var.project_name}-judgment-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "judgment_queue" {
  name                       = "${var.project_name}-judgment-queue"
  visibility_timeout_seconds = 180
  receive_wait_time_seconds  = 10

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.judgment_dlq.arn
    maxReceiveCount     = 3
  })
}
