# frozen_string_literal: true

# Dynamoid configuration for DynamoDB

# テスト環境の場合は最初に設定を適用（after_initializeより前）
if Rails.env.test?
  Dynamoid.configure do |config|
    config.namespace = 'aruaruarena_test'
    config.endpoint = ENV['DYNAMODB_ENDPOINT'] || 'http://localhost:8000'
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
      config.access_key = ENV.fetch('AWS_ACCESS_KEY_ID', nil)
      config.secret_key = ENV.fetch('AWS_SECRET_ACCESS_KEY', nil)
      config.namespace = nil # 本番ではネームスペースなし
    end
  end
end
