# frozen_string_literal: true

FactoryBot.define do
  factory :judgment do
    post
    persona { 'hiroyuki' }
    id { SecureRandom.uuid }
    succeeded { true }
    error_code { nil }
    empathy { 15 }
    humor { 15 }
    brevity { 15 }
    originality { 15 }
    expression { 15 }
    total_score { 75 }
    comment { 'それって本当？' }
    judged_at { Time.now.to_i }

    trait :failed do
      succeeded { false }
      error_code { 'timeout' }
      empathy { nil }
      humor { nil }
      brevity { nil }
      originality { nil }
      expression { nil }
      total_score { nil }
      comment { nil }
    end

    trait :hiroyuki do
      persona { 'hiroyuki' }
      comment { 'それって本当？' }
    end

    trait :dewi do
      persona { 'dewi' }
      comment { 'あら、素敵！' }
    end

    trait :nakao do
      persona { 'nakao' }
      comment { '運命ですね〜' }
    end
  end
end
