# FactoryBot configuration for DynamoDB (Dynamoid)
RSpec.configure do |config|
  # Include FactoryBot methods for all specs
  config.include FactoryBot::Syntax::Methods

  # Set factory directory
  config.factory_bot = false
  
  # Configure FactoryBot for Dynamoid
  FactoryBot.define do
    # No ActiveRecord configuration needed
  end
end
