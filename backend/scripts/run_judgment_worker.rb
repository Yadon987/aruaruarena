# frozen_string_literal: true

require_relative '../config/environment'

unless Rails.env.development?
  warn '[LocalJudgmentWorker] development 環境でのみ実行してください'
  exit 1
end

if ENV['LOCAL_JUDGE_WORKER'] != 'true'
  warn '[LocalJudgmentWorker] LOCAL_JUDGE_WORKER=true を設定してください'
  exit 1
end

worker = LocalJudgmentWorkerService.new

if ARGV.include?('--once')
  worker.run_once
else
  worker.run
end
