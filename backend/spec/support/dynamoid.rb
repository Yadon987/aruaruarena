# frozen_string_literal: true

# DynamoDB Localの設定
RSpec.configure do |config|
  config.before(:suite) do
    endpoint = ENV['DYNAMODB_ENDPOINT'].presence || 'http://127.0.0.1:8002'
    ENV['DYNAMODB_ENDPOINT'] = endpoint

    # テスト用DynamoDB設定
    Dynamoid.configure do |dynamoid_config|
      dynamoid_config.endpoint = endpoint
      dynamoid_config.namespace = 'aruaruarena_test'
      dynamoid_config.warn_on_scan = false
      dynamoid_config.read_capacity = 5
      dynamoid_config.write_capacity = 5
    end

    existing_tables = nil
    attempts = 0

    begin
      existing_tables = Dynamoid.adapter.list_tables
    rescue Seahorse::Client::NetworkingError, Errno::ECONNREFUSED => e
      attempts += 1
      raise e if attempts >= 10

      sleep 1
      retry
    end

    [Post, Judgment, RateLimit].each do |model|
      next if existing_tables.include?(model.table_name)

      model.create_table
      existing_tables = Dynamoid.adapter.list_tables
    end

    next unless defined?(DuplicateCheck)
    next if existing_tables.include?(DuplicateCheck.table_name)

    Dynamoid.adapter.create_table(DuplicateCheck.table_name, :body_hash, {})
  end
end
