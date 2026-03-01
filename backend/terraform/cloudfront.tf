# =============================================================================
# CloudFront - フロントエンド配信とクローラー用OGP分岐
# =============================================================================
#
# 重要:
# - /posts/:id は通常ユーザーにはSPA(index.html)を返す
# - クローラーにはLambda@Edge(origin-request)でAPI Gatewayへ転送する
# - origin-request で User-Agent 判定するため、CloudFront から User-Agent を転送する
#

locals {
  frontend_s3_origin_id = "${var.project_name}-frontend-s3-origin"
  api_gateway_origin_id = "api-gateway-origin"
  api_gateway_domain    = replace(aws_apigatewayv2_api.lambda.api_endpoint, "https://", "")
}

resource "aws_cloudfront_origin_request_policy" "crawler_user_agent" {
  name    = "${var.project_name}-crawler-user-agent-only"
  comment = "Lambda@Edgeでクローラー判定するためUser-Agentのみ転送"

  cookies_config {
    cookie_behavior = "none"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["User-Agent"]
    }
  }

  query_strings_config {
    query_string_behavior = "none"
  }
}

import {
  to = aws_cloudfront_distribution.frontend
  id = var.cloudfront_distribution_id
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} frontend distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  http_version        = "http2"

  origin {
    domain_name         = local.api_gateway_domain
    origin_id           = local.api_gateway_origin_id
    connection_attempts = 3
    connection_timeout  = 10

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1", "TLSv1.1", "TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  origin {
    domain_name              = "${var.frontend_s3_bucket_name}.s3.${var.aws_region}.amazonaws.com"
    origin_id                = local.frontend_s3_origin_id
    origin_access_control_id = var.frontend_origin_access_control_id
    connection_attempts      = 3
    connection_timeout       = 10

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = local.frontend_s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = var.posts_cache_policy_id

    # origin-request の Lambda@Edge で User-Agent 判定するため転送する
    origin_request_policy_id = aws_cloudfront_origin_request_policy.crawler_user_agent.id

    lambda_function_association {
      event_type   = "origin-request"
      include_body = false
      lambda_arn   = aws_lambda_function.lambda_edge_ogp.qualified_arn
    }
  }

  # OGP画像はAPI Gateway経由でOgpControllerが動的生成
  # S3への事前生成ではなく、リクエスト時に画像を生成してCloudFrontでキャッシュする
  ordered_cache_behavior {
    path_pattern           = "/ogp/posts/*.png"
    target_origin_id       = local.api_gateway_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = var.ogp_cache_policy_id
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1"
  }
}
