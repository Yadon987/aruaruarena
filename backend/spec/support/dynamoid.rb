# frozen_string_literal: true

# DynamoDB Localの設定
RSpec.configure do |config|
  config.before(:suite) do
    # テスト用DynamoDB設定
    Dynamoid.configure do |dynamoid_config|
      dynamoid_config.endpoint = 'http://localhost:8000'
      dynamoid_config.namespace = 'aruaruarena_test'
      dynamoid_config.warn_on_scan = false
      dynamoid_config.read_capacity = 5
      dynamoid_config.write_capacity = 5
    end
  end
end
