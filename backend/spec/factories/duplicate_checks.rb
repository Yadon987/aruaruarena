# frozen_string_literal: true

FactoryBot.define do
  factory :duplicate_check do
    sequence(:body_hash) { |n| "hash_#{n}" }
    post_id { SecureRandom.uuid }
    expires_at { Time.now.to_i + 86_400 }  # 24時間後（秒単位）
  end
end
