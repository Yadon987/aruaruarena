# frozen_string_literal: true

# Dynamoid configuration for DynamoDB

test_endpoint = ENV.fetch('DYNAMODB_ENDPOINT', nil)
test_endpoint = nil if Rails.env.test? && ['http://127.0.0.1:8000', 'http://localhost:8000'].include?(test_endpoint)

# テスト環境の場合は最初に設定を適用（after_initializeより前）
if Rails.env.test?
  Dynamoid.configure do |config|
    config.namespace = 'aruaruarena_test'
    config.endpoint = test_endpoint || 'http://127.0.0.1:8002'
    config.region = ENV['AWS_REGION'] || 'us-east-1'
    config.access_key = ENV['AWS_ACCESS_KEY_ID'] || 'test'
    config.secret_key = ENV['AWS_SECRET_ACCESS_KEY'] || 'test'
  end
end

# その他の環境ではafter_initializeで設定
Rails.application.config.after_initialize do
  # テスト環境は既に設定済みなのでスキップ
  next if Rails.env.test?

  Dynamoid.configure do |config|
    # 開発環境用設定
    if Rails.env.development?
      config.endpoint = ENV['DYNAMODB_ENDPOINT'] || 'http://localhost:8000'
      config.region = ENV['AWS_REGION'] || 'ap-northeast-1'
      config.access_key = ENV['AWS_ACCESS_KEY_ID'] || 'dummy'
      config.secret_key = ENV['AWS_SECRET_ACCESS_KEY'] || 'dummy'
      config.namespace = 'aruaruarena_development'
    # 本番環境用設定
    else
      config.endpoint = nil # AWS DynamoDB
      config.region = ENV['AWS_REGION'] || 'ap-northeast-1'
      # Lambda実行ロールの一時認証情報（session token含む）を利用する。
      # access_key/secret_key を個別指定すると session token が欠け、認証エラーを起こしうる。
      config.access_key = nil
      config.secret_key = nil
      config.namespace = nil # 本番ではネームスペースなし
    end
  end
end
