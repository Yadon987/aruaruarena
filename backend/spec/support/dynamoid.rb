# Dynamoid（DynamoDB ORM）のテスト環境設定

Dynamoid.configure do |config|
  # テスト用のネームスペース
  config.namespace = 'aruaruarena_test'

  # DynamoDBエンドポイント（ローカル開発環境）
  config.endpoint = ENV['DYNAMODB_ENDPOINT'] || 'http://localhost:8000'

  # AWSリージョン
  config.region = ENV['AWS_REGION'] || 'us-east-1'

  # アクセスキー（ローカル用ダミー）
  config.access_key = ENV['AWS_ACCESS_KEY_ID'] || 'test'
  config.secret_key = ENV['AWS_SECRET_ACCESS_KEY'] || 'test'
end
