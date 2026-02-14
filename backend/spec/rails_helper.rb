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
  # Remove this line to enable support for ActiveRecord
  config.use_active_record = false

  # FactoryBot syntax methods
  config.include FactoryBot::Syntax::Methods

  # Dynamoid テーブルのクリーンアップとセットアップ
  config.before(:suite) do
    # テーブルを確認（デバッグ用）
    if defined?(Dynamoid)
      tables = Dynamoid.adapter.list_tables
      puts "[Before Suite] Existing tables: #{tables.inspect}" if ENV['DEBUG']
    end
  end

  # 各テスト前にテーブルをクリーンアップ
  config.before(:each) do
    # DynamoDB Localの整合性問題を回避するため、各テスト前にクリーンアップ
    # delete_allは非同期ですが、テスト環境では十分に高速です
    Post.delete_all if defined?(Post)
    Judgment.delete_all if defined?(Judgment)
    RateLimit.delete_all if defined?(RateLimit)
    DuplicateCheck.delete_all if defined?(DuplicateCheck)
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

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!
  # arbitrary gems may also be filtered via:
  # config.filter_gems_from_backtrace("gem name")
end
