# Dynamoid（DynamoDB ORM）のテスト環境設定

# テスト環境用のDynamoDB設定
if ENV['DYNAMODB_ENDPOINT']
  # ローカルDynamoDBを使用する場合
  Dynamoid.configure do |config|
    config.namespace = 'aruaruarena_test'
    config.endpoint = ENV['DYNAMODB_ENDPOINT']
    config.access_key = 'test' # ローカル用ダミー
    config.secret_key = 'test' # ローカル用ダミー
    config.region = 'us-east-1'
  end
else
  # Lambda環境または開発環境
  # 環境変数またはshared_credentialsを使用
  Dynamoid.configure do |config|
    config.namespace = 'aruaruarena_test'
    config.endpoint = ENV['DYNAMODB_ENDPOINT'] || 'http://localhost:8000' # 強制的にローカルエンドポイントを指定
    config.region = ENV['AWS_REGION'] || 'us-east-1'
    config.access_key = ENV['AWS_ACCESS_KEY_ID'] || 'test'
    config.secret_key = ENV['AWS_SECRET_ACCESS_KEY'] || 'test'
  end
end
