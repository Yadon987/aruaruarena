# frozen_string_literal: true

FactoryBot.define do
  factory :rate_limit do
    identifier { 'ip#' + SecureRandom.hex[0..15] }
    expires_at { Time.now.to_i + 300 } # 5分後
  end
end
