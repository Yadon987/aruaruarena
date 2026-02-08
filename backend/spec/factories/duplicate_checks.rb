# frozen_string_literal: true

FactoryBot.define do
  factory :duplicate_check do
    body_hash { DuplicateCheck.generate_body_hash('test post') }
    post_id { SecureRandom.uuid }
    expires_at { Time.now.to_i + 86_400 } # 24時間後
  end
end
