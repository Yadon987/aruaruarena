# frozen_string_literal: true

# Adapterテスト用の共通ヘルパー
#
# @note このモジュールは spec/support/ に配置され、rails_helper.rb で自動的に読み込まれます
module AdapterTestHelpers
  # 環境変数をモックするヘルパーメソッド
  #
  # @param key [String] 環境変数名
  # @param value [String, nil] 環境変数の値
  # @return [void]
  #
  # @example
  #   stub_env('OPENAI_API_KEY', 'test_key')
  #   stub_env('GLM_API_KEY', nil)
  def stub_env(key, value)
    allow(ENV).to receive(:[]).with(key).and_return(value)
  end
end

RSpec.configure do |config|
  config.include AdapterTestHelpers, type: :model
end
