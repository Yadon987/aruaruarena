# frozen_string_literal: true

# This file is copied to spec/ when you run 'rails generate rspec:install'
require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'

# Prevent database truncation if the environment is production
# Rails環境を読み込んだ後にチェックする

require_relative '../config/environment'
# Rails環境が読み込まれたので、production環境でないか確認
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
# Add additional requires below this line. Rails is not loaded until this point!

# Define support path
support_path = Rails.root.join('spec/support/**/*.rb')

# FactoryBot configuration
require 'support/factory_bot'

# VCR configuration
require 'support/vcr'

# Requires supporting ruby files with custom matchers and macros, etc, in
# spec/support/ and its subdirectories.
Dir[support_path].each { |f| require f }

RSpec.configure do |config|
  config.include DynamoDBTestHelpers

  config.add_setting :dynamodb_available, default: false
  config.add_setting :dynamodb_table_names, default: []
  config.add_setting :dynamodb_checked, default: false

  # Remove this line to enable support for ActiveRecord
  config.use_active_record = false

  # FactoryBot syntax methods
  config.include FactoryBot::Syntax::Methods

  # Dynamoid テーブルのクリーンアップとセットアップ
  config.before(:suite) do
    config.dynamodb_available = false
    config.dynamodb_table_names = []
    config.dynamodb_checked = false
  end

  # 各テスト前にテーブルをクリーンアップ
  config.before(:each, :dynamodb) do |example|
    next unless defined?(Dynamoid)

    described_class = example.metadata[:described_class]
    next if described_class.is_a?(Class) && described_class <= BaseAiAdapter
    next if example.metadata[:full_description].start_with?('Factories ')
    next if example.file_path.match?(%r{/spec/adapters/})
    next if example.file_path.match?(%r{/spec/factories/factories_spec\.rb\z/})
    next if example.file_path.match?(%r{/spec/services/judge_error_spec\.rb\z/})
    next if example.file_path.match?(%r{/spec/requests/(api/)?health_check_spec\.rb\z/})

    helper = Object.new.extend(DynamoDBTestHelpers)

    # テスト実行時に指定されたエンドポイントを優先して適用する
    if ENV['DYNAMODB_ENDPOINT'].present? && Dynamoid.config.endpoint != ENV['DYNAMODB_ENDPOINT']
      Dynamoid.config.endpoint = ENV.fetch('DYNAMODB_ENDPOINT', nil)
    end

    unless config.dynamodb_checked
      config.dynamodb_available = helper.dynamodb_available?
      config.dynamodb_checked = true
      if config.dynamodb_available
        config.dynamodb_table_names = helper.ensure_test_tables!
        puts "[Before Suite] Existing tables: #{config.dynamodb_table_names.inspect}" if ENV['DEBUG']
      end
    end

    raise 'DynamoDB Localに接続できません。docker compose up -d を実行して再試行してください。' unless config.dynamodb_available

    table_names = config.dynamodb_table_names.presence || helper.ensure_test_tables!
    target_table_names = Array(example.metadata[:dynamodb_tables]).presence || table_names
    helper.cleanup_test_tables!(target_table_names)
  rescue Aws::DynamoDB::Errors::ServiceError, Errno::ECONNREFUSED => e
    warn "Failed to cleanup DynamoDB tables: #{e.message}"
    raise
  end

  # Shoulda Matchers configuration
  config.include(Shoulda::Matchers::ActiveModel, type: :model)
  # Dynamic include based on availability for ActiveRecord matchers if needed,
  # but keeping consistent with root config which had it:
  config.include(Shoulda::Matchers::ActiveRecord, type: :model) if defined?(Shoulda::Matchers::ActiveRecord)

  # RSpec Rails uses metadata to mix in different behaviours to your tests,
  # for example enabling you to call `get` and `post` in request specs. e.g.:
  #
  #     RSpec.describe UsersController, type: :request do
  #       # ...
  #     end
  #
  # The different available types are documented in the features, such as in
  # https://rspec.info/features/8-0/rspec-rails
  #
  # You can also this infer these behaviours automatically by location, e.g.
  # /spec/models would pull in the same behaviour as `type: :model` but this
  # behaviour is considered legacy and will be removed in a future version.
  #
  # To enable this behaviour uncomment the line below.
  config.infer_spec_type_from_file_location!

  # Adapter用共通モック設定
  config.before(:each, :adapter) do
    # AdapterTestHelpersモジュールのメソッドを使用して各Adapterをモック
    adapter_test_helpers = Object.new
    adapter_test_helpers.extend(AdapterTestHelpers)
    adapter_test_helpers.mock_adapter_judge(GeminiAdapter)
    adapter_test_helpers.mock_adapter_judge(GlmAdapter)
    adapter_test_helpers.mock_adapter_judge(DewiAdapter)
    adapter_test_helpers.mock_adapter_judge(OpenAiAdapter)
  end
  config.include AdapterTestHelpers, type: :model
  config.include AdapterTestHelpers, type: :service

  config.define_derived_metadata(type: :request) { |meta| meta[:dynamodb] = true }
  config.define_derived_metadata(type: :model) { |meta| meta[:dynamodb] = true }
  config.define_derived_metadata(type: :service) { |meta| meta[:dynamodb] = true }

  # DB非依存specはDynamoDBクリーンアップ対象から外す
  config.define_derived_metadata(file_path: %r{/spec/adapters/}) { |meta| meta[:dynamodb] = false }
  config.define_derived_metadata(file_path: %r{/spec/factories/factories_spec\.rb\z/}) do |meta|
    meta[:dynamodb] = false
  end
  config.define_derived_metadata(file_path: %r{/spec/services/judge_error_spec\.rb\z/}) do |meta|
    meta[:dynamodb] = false
  end
  config.define_derived_metadata(file_path: %r{/spec/requests/(api/)?health_check_spec\.rb\z/}) do |meta|
    meta[:dynamodb] = false
  end

  # テーブルクリーンアップをspec単位で最小化する
  config.define_derived_metadata(file_path: %r{/spec/models/rate_limit_spec\.rb\z/}) do |meta|
    meta[:dynamodb_tables] = [RateLimit.table_name]
  end
  config.define_derived_metadata(file_path: %r{/spec/services/rate_limiter_service_spec\.rb\z/}) do |meta|
    meta[:dynamodb_tables] = [RateLimit.table_name]
  end
  config.define_derived_metadata(file_path: %r{/spec/models/duplicate_check_spec\.rb\z/}) do |meta|
    meta[:dynamodb_tables] = [DuplicateCheck.table_name]
  end
  config.define_derived_metadata(file_path: %r{/spec/services/duplicate_check_service_spec\.rb\z/}) do |meta|
    meta[:dynamodb_tables] = [DuplicateCheck.table_name]
  end

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!
  # arbitrary gems may also be filtered via:
  # config.filter_gems_from_backtrace("gem name")
end
