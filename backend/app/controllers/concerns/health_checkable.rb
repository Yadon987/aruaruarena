# frozen_string_literal: true

# health checkコントローラー向けの共通判定ロジック
module HealthCheckable
  extend ActiveSupport::Concern

  BASE_REQUIRED_ENV_VARS = %w[
    SECRET_KEY_BASE
    DYNAMODB_TABLE_POSTS
    GEMINI_API_KEY
    CEREBRAS_API_KEY
    GROQ_API_KEY
  ].freeze

  private

  def required_env_vars
    vars = BASE_REQUIRED_ENV_VARS.dup
    vars << 'SQS_QUEUE_URL' unless local_worker_mode? || synchronous_mode?
    vars
  end

  def local_worker_mode?
    Rails.env.development? && ENV['LOCAL_JUDGE_WORKER'] == 'true'
  end

  def synchronous_mode?
    Rails.env.development? && ENV['SYNCHRONOUS_JUDGE'] == 'true'
  end

  def build_worker_status
    return nil if synchronous_mode?
    return nil unless local_worker_mode?

    LocalJudgmentWorkerHeartbeatService.current_status
  end
end
