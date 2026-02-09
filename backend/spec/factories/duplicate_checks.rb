# frozen_string_literal: true

FactoryBot.define do
  factory :duplicate_check do
    sequence(:body_hash) { |n| DuplicateCheck.generate_body_hash("test post #{n}") }
    post_id { SecureRandom.uuid }
    expires_at { (Time.now.to_i + 86_400).to_s } # String型に変更
  end
end
