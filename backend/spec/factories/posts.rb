# frozen_string_literal: true

FactoryBot.define do
  factory :post do
    id { SecureRandom.uuid }
    nickname { '太郎' }
    body { 'スヌーズ押して二度寝' }
    status { 'judging' }
    average_score { nil }
    judges_count { 0 }
    score_key { nil }
    created_at { Time.now.to_i.to_s }

    trait :scored do
      status { 'scored' }
      average_score { 85.5 }
      judges_count { 3 }
      after(:build) do |post|
        post.score_key = post.generate_score_key
      end
    end

    trait :failed do
      status { 'failed' }
      judges_count { 1 }
    end
  end
end
