# frozen_string_literal: true

require_relative '../config/environment'
require 'uri'

unless Rails.env.development?
  puts '[warn] このチェックは開発環境（development）のみを想定しています。'
  exit 1
end

base_required_keys = %w[
  DYNAMODB_TABLE_POSTS
  GEMINI_API_KEY
  CEREBRAS_API_KEY
  GROQ_API_KEY
]

sqs_required_keys = %w[
  AWS_REGION
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  SQS_QUEUE_URL
]

dynamodb_endpoint = ENV['DYNAMODB_ENDPOINT'] || 'http://localhost:8000'
errors = []
warnings = []
local_worker_mode = ENV['LOCAL_JUDGE_WORKER'] == 'true'
synchronous_mode = ENV['SYNCHRONOUS_JUDGE'] == 'true'

def placeholder_value?(value)
  normalized = value.to_s.strip
  return true if normalized.empty?

  normalized.match?(/\Ayour[_-]/i) ||
    normalized.include?('<') ||
    normalized.include?('>') ||
    %w[dummy example placeholder].any? { |token| normalized.downcase.include?(token) }
end

def valid_sqs_queue_url?(value)
  uri = URI.parse(value)
  uri.is_a?(URI::HTTPS) &&
    uri.host&.include?('amazonaws.com') &&
    uri.path.to_s.split('/').reject(&:empty?).size == 2
rescue URI::InvalidURIError
  false
end

if ENV['SYNCHRONOUS_JUDGE'] == 'true'
  warnings << 'SYNCHRONOUS_JUDGE が true です。開発中の審査をローカル同期実行にせず、本番同等フローを使う場合は false にしてください。'
end

errors << 'LOCAL_JUDGE_WORKER と SYNCHRONOUS_JUDGE を同時に true にしないでください' if local_worker_mode && synchronous_mode

warnings << 'LOCAL_JUDGE_WORKER=true のため、審査はローカルワーカーで実行されます' if local_worker_mode

unless dynamodb_endpoint.include?('localhost') || dynamodb_endpoint.include?('127.0.0.1')
  errors << "DYNAMODB_ENDPOINT がローカルではありません（現在値: #{dynamodb_endpoint}）"
end

required_keys = base_required_keys.dup
required_keys.concat(sqs_required_keys) unless local_worker_mode || synchronous_mode

required_keys.each do |key|
  value = ENV.fetch(key, nil)
  errors << "#{key} が未設定です" if value.nil? || value.strip.empty?

  next unless ENV[key]
  next unless placeholder_value?(ENV[key])

  errors << "#{key} がプレースホルダ値です"
end

if required_keys.include?('SQS_QUEUE_URL') && ENV.fetch('SQS_QUEUE_URL',
                                                        nil) && placeholder_value?(ENV.fetch('SQS_QUEUE_URL', nil))
  errors << 'SQS_QUEUE_URL がプレースホルダ値です'
elsif required_keys.include?('SQS_QUEUE_URL') && ENV.fetch('SQS_QUEUE_URL',
                                                           nil) && !valid_sqs_queue_url?(ENV.fetch('SQS_QUEUE_URL',
                                                                                                   nil))
  errors << "SQS_QUEUE_URL の形式が不正です（現在値: #{ENV.fetch('SQS_QUEUE_URL', nil)}）"
end

puts "[warn] #{warnings.join("\n[warn] ")}" if warnings.any?

if errors.any?
  puts '[error] 開発環境の必須チェックで未設定または不正な値を検出しました。'
  puts errors.map { |message| " - #{message}" }.join("\n")
  puts
  puts 'DBはローカル利用、その他は本番同等運用するために env を見直してください。'
  exit 1
end

puts '[ok] 開発環境の審査フロー（DB: local、判定: prod相当）として起動可能です。'
exit 0
