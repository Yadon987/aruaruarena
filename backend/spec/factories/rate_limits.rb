# frozen_string_literal: true

FactoryBot.define do
  factory :rate_limit do
    sequence(:identifier) { |n| RateLimit.generate_ip_identifier("127.0.0.#{n}") }
    expires_at { (Time.now.to_i + 300).to_s } # String型に変更
  end
end
