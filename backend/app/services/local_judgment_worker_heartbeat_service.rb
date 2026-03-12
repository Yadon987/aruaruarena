# frozen_string_literal: true

require 'fileutils'
require 'json'

# ローカル審査ワーカーの起動状態を health check から参照するための心拍管理
class LocalJudgmentWorkerHeartbeatService
  HEARTBEAT_PATH = Rails.root.join('tmp/local_judgment_worker_heartbeat.json')
  START_COMMAND = 'bundle exec ruby scripts/run_judgment_worker.rb'

  class << self
    def mark_running!(processed_count: nil)
      write_payload(
        'status' => 'ok',
        'pid' => Process.pid,
        'updated_at' => Time.current.iso8601,
        'processed_count' => processed_count,
        'command' => START_COMMAND
      )
    end

    def mark_stopped!
      write_payload(
        'status' => 'unhealthy',
        'pid' => Process.pid,
        'updated_at' => Time.current.iso8601,
        'reason' => 'worker_stopped',
        'command' => START_COMMAND
      )
    end

    def current_status
      payload = read_payload
      return default_status('heartbeat_missing') if payload.nil?

      pid = payload['pid'].to_i
      return build_running_status(payload, pid) if payload['status'] == 'ok' && process_alive?(pid)

      build_unhealthy_status(payload, pid)
    end

    private

    def write_payload(payload)
      FileUtils.mkdir_p(HEARTBEAT_PATH.dirname)
      temp_path = heartbeat_temp_path
      write_temp_payload(temp_path, JSON.generate(payload))

      File.rename(temp_path, HEARTBEAT_PATH)
    rescue StandardError
      FileUtils.rm_f(temp_path) if defined?(temp_path) && temp_path
      raise
    end

    def heartbeat_temp_path
      HEARTBEAT_PATH.dirname.join(".#{HEARTBEAT_PATH.basename}.tmp-#{Process.pid}-#{SecureRandom.hex(4)}")
    end

    def write_temp_payload(path, json)
      File.open(path, 'w') do |file|
        file.write(json)
        file.flush
        file.fsync
      end
    end

    def read_payload
      return nil unless File.exist?(HEARTBEAT_PATH)

      JSON.parse(File.read(HEARTBEAT_PATH))
    rescue JSON::ParserError
      nil
    end

    def process_alive?(pid)
      return false if pid <= 0

      Process.kill(0, pid)
      true
    rescue Errno::ESRCH
      false
    rescue Errno::EPERM
      true
    end

    def default_status(reason)
      {
        'mode' => 'local_worker',
        'status' => 'unhealthy',
        'reason' => reason,
        'command' => START_COMMAND
      }
    end

    def build_running_status(payload, pid)
      {
        'mode' => 'local_worker',
        'status' => 'ok',
        'pid' => pid,
        'updated_at' => payload['updated_at'],
        'processed_count' => payload['processed_count'],
        'command' => payload['command'] || START_COMMAND
      }
    end

    def build_unhealthy_status(payload, pid)
      {
        'mode' => 'local_worker',
        'status' => 'unhealthy',
        'pid' => pid.positive? ? pid : nil,
        'updated_at' => payload['updated_at'],
        'processed_count' => payload['processed_count'],
        'reason' => payload['reason'] || 'worker_not_running',
        'command' => payload['command'] || START_COMMAND
      }
    end
  end
end
