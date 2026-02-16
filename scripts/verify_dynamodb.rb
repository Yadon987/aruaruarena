gemfile_path = File.expand_path('../backend/Gemfile', __dir__)
if File.exist?(gemfile_path)
  ENV['BUNDLE_GEMFILE'] ||= gemfile_path
  require 'bundler/setup'
end

require 'aws-sdk-dynamodb'

$stdout.sync = true

# 環境変数を優先し、未設定時はローカル開発向けの既定値を使う
endpoint = ENV.fetch('DYNAMODB_ENDPOINT', 'http://localhost:8000')
region = ENV.fetch('AWS_REGION', 'ap-northeast-1')
access_key_id = ENV.fetch('AWS_ACCESS_KEY_ID', 'local')
secret_access_key = ENV.fetch('AWS_SECRET_ACCESS_KEY', 'local')

client = Aws::DynamoDB::Client.new(
  endpoint: endpoint,
  region: region,
  access_key_id: access_key_id,
  secret_access_key: secret_access_key
)

begin
  puts "DynamoDB 接続確認を開始します: #{endpoint}"
  tables = client.list_tables.table_names

  if tables.empty?
    puts '接続成功: テーブルはまだ作成されていません。'
  else
    puts '接続成功: 既存テーブル一覧'
    tables.each { |table_name| puts "- #{table_name}" }
  end
  exit(0)
rescue Aws::DynamoDB::Errors::ServiceError => e
  warn "DynamoDB エラー: #{e.message}"
  exit(1)
rescue StandardError => e
  warn "接続エラー: #{e.message}"
  exit(1)
end
