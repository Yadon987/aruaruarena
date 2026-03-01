# =============================================================================
# Lambda@Edge - OGPメタタグ配信用クローラー判定関数
# =============================================================================
#
# このLambda@Edge関数はCloudFrontのOrigin Request Triggerで実行され、
# クローラー（Twitter/Facebook/LINE等）からのアクセス時にバックエンドAPIに転送する。
#
# フロー:
# 1. クローラーが /posts/{id} にアクセス
# 2. Lambda@EdgeがUser-Agentを判定
# 3. クローラーの場合、API Gatewayオリジンに転送
# 4. バックエンドがOGPメタタグ付きHTMLを返す
#

# Lambda@Edge関数のコード
data "archive_file" "lambda_edge_ogp" {
  type        = "zip"
  output_path = "${path.module}/lambda_edge_ogp.zip"

  source {
    content  = <<-PYTHON
import json

# クローラーのUser-Agentパターン
CRAWLER_PATTERNS = [
    'twitterbot',
    'facebookexternalhit',
    'line-poker',
    'discordbot',
    'slackbot',
    'googlebot',
    'bingbot',
    'linkedinbot',
    'pinterest',
    'applebot'
]

def lambda_handler(event, context):
    """
    CloudFront Origin Request Triggerで実行される関数。
    クローラーからのアクセス時にAPI Gatewayオリジンに転送する。
    """
    request = event['Records'][0]['cf']['request']
    headers = request.get('headers', {})

    # User-Agentを取得
    user_agent = ''
    if 'user-agent' in headers:
        for ua_header in headers['user-agent']:
            user_agent += ua_header['value']

    user_agent_lower = user_agent.lower()

    # クローラーかどうか判定
    is_crawler = any(pattern in user_agent_lower for pattern in CRAWLER_PATTERNS)

    # クローラーかつ /posts/{id} パスの場合、APIオリジンへ転送
    uri = request.get('uri', '')
    if is_crawler and uri.startswith('/posts/'):
        # API Gatewayオリジンへ転送
        # ドメイン名のみ（プロトコルなし）
        api_domain = '${replace(aws_apigatewayv2_api.lambda.api_endpoint, "https://", "")}'

        # /posts/{id} -> /api/posts/{id} に変換
        request['uri'] = '/api' + uri

        request['origin'] = {
            'custom': {
                'domainName': api_domain,
                'port': 443,
                'protocol': 'https',
                'path': '',
                'sslProtocols': ['TLSv1.2'],
                'readTimeout': 30,
                'keepaliveTimeout': 5,
                'customHeaders': {}
            }
        }

        # HostヘッダーをAPI Gatewayのドメインに更新
        request['headers']['host'] = [{
            'key': 'Host',
            'value': api_domain
        }]

    return request
    PYTHON
    filename = "index.py"
  }
}

# Lambda@Edge関数（us-east-1で作成必須）
resource "aws_lambda_function" "lambda_edge_ogp" {
  provider = aws.us_east_1

  filename         = data.archive_file.lambda_edge_ogp.output_path
  function_name    = "${var.project_name}-lambda-edge-ogp"
  role             = aws_iam_role.lambda_edge_ogp.arn
  handler          = "index.lambda_handler"
  source_code_hash = data.archive_file.lambda_edge_ogp.output_base64sha256
  runtime          = "python3.11"

  # Lambda@Edgeにはpublish=trueが必須
  publish = true

  # Lambda@Edgeの制限: メモリ128MB、タイムアウト5秒以内
  memory_size = 128
  timeout     = 5

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "OGP meta tag delivery for crawlers"
  }
}

# Lambda@Edge関数のARN（バージョン付き）を出力
output "lambda_edge_ogp_qualified_arn" {
  description = "Qualified ARN of the Lambda@Edge function for OGP (includes version)"
  value       = aws_lambda_function.lambda_edge_ogp.qualified_arn
}
