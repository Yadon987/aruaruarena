# Dynamoid configuration for DynamoDB
Rails.application.config.after_initialize do
  Dynamoid.configure do |config|
    # DynamoDB endpoint (Local or AWS)
    if Rails.env.development? || Rails.env.test?
      # DynamoDB Local
      config.endpoint = ENV['DYNAMODB_ENDPOINT'] || 'http://localhost:8000'
    else
      # Production AWS DynamoDB
      config.endpoint = nil
    end

    # AWS Region
    config.region = ENV['AWS_REGION'] || 'ap-northeast-1'

    # Access keys (dummy for Local, actual for production)
    config.access_key = ENV['AWS_ACCESS_KEY_ID'] || 'dummy'
    config.secret_key = ENV['AWS_SECRET_ACCESS_KEY'] || 'dummy'

    # Namespace for tables (optional)
    config.namespace = "aruaruarena_#{Rails.env}" unless Rails.env.production?
  end
end
