source "https://rubygems.org"
git_source(:github) { |repo| "https://github.com/#{repo}.git" }

# =============================================================================
# Core
# =============================================================================
gem "rails", "~> 8.0.0"
gem "puma", ">= 5.0"
gem "bootsnap", require: false

# =============================================================================
# API & Network
# =============================================================================
gem "rack-cors"
gem "faraday"
gem "parallel"

# =============================================================================
# Database (DynamoDB)
# =============================================================================
gem "dynamoid", "~> 3.11"
gem "aws-sdk-dynamodb"

# =============================================================================
# Image Processing
# =============================================================================
gem "mini_magick"

# =============================================================================
# Utilities
# =============================================================================
gem "tzinfo-data", platforms: %i[ windows jruby ]

# =============================================================================
# Development & Test
# =============================================================================
group :development, :test do
  # Debugging
  gem "debug", platforms: %i[ mri windows ]
  gem "pry-rails"

  # Testing Framework
  gem "rspec-rails", "~> 8.0"
  gem "factory_bot_rails"
  gem "faker"

  # Code Quality
  gem "rubocop-rails", "~> 2.5"
  gem "brakeman", "~> 6.1"  # CIで使用

  # Environment
  gem "dotenv-rails"
end

# =============================================================================
# Test Only
# =============================================================================
group :test do
  # Coverage
  gem "simplecov", require: false

  # Matchers & Mocks
  gem "shoulda-matchers"
  gem "webmock"
  gem "vcr"

  # CI Integration
  gem "rspec_junit_formatter", "~> 0.6"  # CIで使用
end
