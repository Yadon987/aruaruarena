# frozen_string_literal: true

# FactoryBot configuration for DynamoDB (Dynamoid)
require 'factory_bot'

RSpec.configure do |config|
  # FactoryBot syntax methods
  config.include FactoryBot::Syntax::Methods

  # Factories directoryの指定
  config.before(:suite) do
    FactoryBot.find_definitions
  end
end
