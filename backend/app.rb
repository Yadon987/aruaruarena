# frozen_string_literal: true

# rubocop:disable Style/GlobalVars

require_relative 'config/boot'
require 'json'
require 'lamby'
require_relative 'config/application'
require_relative 'config/environment'

$app = Rack::Builder.new { run Rails.application }.to_app

def handler(event:, context:)
  return handle_sqs_event(event) if event['Records']&.any? { |record| record['eventSource'] == 'aws:sqs' }

  Lamby.handler $app, event, context, rack_adapter: :http_api_v2
end

def handle_sqs_event(event)
  event.fetch('Records', []).each do |record|
    next unless record['eventSource'] == 'aws:sqs'

    body = JSON.parse(record.fetch('body', '{}'))
    post_id = body['post_id']
    next if post_id.blank?

    Rails.logger.info("[SQS Handler] 審査開始: post_id=#{post_id}")
    JudgePostService.call(post_id)
  end

  { batchItemFailures: [] }
end

# rubocop:enable Style/GlobalVars
