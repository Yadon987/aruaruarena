# =============================================================================
# DynamoDB Tables
# =============================================================================

# -----------------------------------------------------------------------------
# postsテーブル（投稿データ）
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "posts" {
  name         = "aruaruarena-posts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  # Attributes
  attribute {
    name = "id"
    type = "S"
  }

  # GSI: RankingIndex（TOP20取得用）
  # status=scoredのみ対象（スパースインデックス）
  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "score_key"
    type = "S"
  }

  # Global Secondary Index: RankingIndex
  global_secondary_index {
    name            = "RankingIndex"
    hash_key        = "status"
    range_key       = "score_key"
    projection_type = "ALL"
  }

  # PITR有効化
  point_in_time_recovery {
    enabled = true
  }

  # タグ
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# judgmentsテーブル（審査結果）
# Composite Primary Key: post_id (PK) + persona (SK)
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "judgments" {
  name         = "aruaruarena-judgments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "post_id"
  range_key    = "persona"

  # Attributes
  attribute {
    name = "post_id"
    type = "S"
  }

  attribute {
    name = "persona"
    type = "S"
  }

  # PITR有効化
  point_in_time_recovery {
    enabled = true
  }

  # タグ
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# rate_limitsテーブル（レート制限）
# Partition Key: identifier (ip#hash or nick#hash)
# TTL: 5分後自動削除
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "rate_limits" {
  name         = "aruaruarena-rate-limits"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "identifier"

  # Attributes
  attribute {
    name = "identifier"
    type = "S"
  }

  # TTL有効化
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  # タグ
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# -----------------------------------------------------------------------------
# duplicate_checksテーブル（重複チェック）
# Partition Key: body_hash
# TTL: 24時間後自動削除
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "duplicate_checks" {
  name         = "aruaruarena-duplicate-checks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "body_hash"

  # Attributes
  attribute {
    name = "body_hash"
    type = "S"
  }

  # TTL有効化
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  # タグ
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
