# frozen_string_literal: true

# OGP生成フローの計測用structured logを出力するサービス
class LogOgpGenerationEventService
  class << self
    def call(event:, post:, **extra)
      return if post.blank?

      Rails.logger.info(build_payload(event:, post:, extra:).to_json)
    end

    private

    def build_payload(event:, post:, extra:)
      {
        event: event,
        post_id: post.id,
        post_status: post.status,
        post_created_at: post.created_at,
        occurred_at: Time.current.iso8601(3)
      }.merge(compact_extra(post, extra))
    end

    def compact_extra(post, extra)
      {
        average_score: post.try(:average_score),
        judges_count: post.try(:judges_count)
      }.merge(extra).compact
    end
  end
end
