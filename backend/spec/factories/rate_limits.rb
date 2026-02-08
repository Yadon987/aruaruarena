# frozen_string_literal: true

FactoryBot.define do
  factory :rate_limit do
    identifier { RateLimit.generate_ip_identifier('127.0.0.1') }
    expires_at { Time.now.to_i + 300 } # 5分後
  end
end
