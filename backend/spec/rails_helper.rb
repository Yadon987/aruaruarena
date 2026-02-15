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
    # テーブルを確認し、存在しない場合は作成（CI環境対策）
    if defined?(Dynamoid)
      begin
        # 必要なテーブルが作成されているか確認
        existing_tables = Dynamoid.adapter.list_tables
        puts "[Before Suite] Existing tables: #{existing_tables.inspect}" if ENV['DEBUG']
        
        # モデルに関連するテーブルを作成
        [Post, Judgment, RateLimit].each do |model|
           if defined?(model) && !existing_tables.include?(model.table_name)
             puts "Creating table for #{model}..."
             model.create_table
           end
        end

        # DuplicateCheckはカスタムキーを使用しているため、明示的に作成
        if defined?(DuplicateCheck) && !existing_tables.include?(DuplicateCheck.table_name)
          puts "Creating table for DuplicateCheck..."
          # create_table(table_name, key, options = {})
          # keyは :id ではなく :body_hash
          Dynamoid.adapter.create_table(DuplicateCheck.table_name, :body_hash, {})
        end
      rescue => e
        puts "Failed to setup DynamoDB tables: #{e.message}"
      end
    end
  end

  # 各テスト前にテーブルをクリーンアップ
  config.before(:each) do
    # DynamoDB Localの整合性問題を回避するため、各テスト前にクリーンアップ
    # truncate_tableはバージョンによって利用できない場合があるため、delete_allを使用
    if defined?(Dynamoid)
      existing_tables = Dynamoid.adapter.list_tables
      [Post, Judgment, RateLimit, DuplicateCheck].each do |model|
        if defined?(model) && existing_tables.include?(model.table_name)
          model.delete_all
        end
      end
    end
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
