# frozen_string_literal: true

FactoryBot.define do
  factory :duplicate_check do
    body_hash { Digest::SHA256.hexdigest('test post')[0..31] }
    post_id { SecureRandom.uuid }
    expires_at { Time.now.to_i + 86_400 } # 24時間後
  end
end
