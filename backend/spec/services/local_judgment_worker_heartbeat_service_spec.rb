# frozen_string_literal: true

require 'rails_helper'
require 'tmpdir'

RSpec.describe LocalJudgmentWorkerHeartbeatService, type: :service do
  let(:tmpdir) { Dir.mktmpdir }
  let(:heartbeat_path) { Pathname.new(tmpdir).join('local_judgment_worker_heartbeat.json') }

  before do
    stub_const("#{described_class}::HEARTBEAT_PATH", heartbeat_path)
  end

  after do
    FileUtils.remove_entry(tmpdir)
  end

  describe '.mark_running!' do
    it '稼働中の心拍ファイルを書き込むこと' do
      described_class.mark_running!(processed_count: 12)

      payload = JSON.parse(File.read(described_class::HEARTBEAT_PATH))
      expect(payload).to include(
        'status' => 'ok',
        'processed_count' => 12,
        'command' => described_class::START_COMMAND
      )
      expect(payload['pid']).to eq(Process.pid)
    end
  end

  describe '.mark_stopped!' do
    it '停止状態の心拍ファイルを書き込むこと' do
      described_class.mark_stopped!

      payload = JSON.parse(File.read(described_class::HEARTBEAT_PATH))
      expect(payload).to include(
        'status' => 'unhealthy',
        'reason' => 'worker_stopped',
        'command' => described_class::START_COMMAND
      )
    end
  end

  describe '.current_status' do
    it '心拍ファイルがなければunhealthyを返すこと' do
      expect(described_class.current_status).to include(
        'status' => 'unhealthy',
        'reason' => 'heartbeat_missing'
      )
    end

    it 'workerが稼働中ならokを返すこと' do
      described_class.mark_running!(processed_count: 3)
      allow(described_class).to receive(:process_alive?).and_return(true)

      expect(described_class.current_status).to include(
        'status' => 'ok',
        'processed_count' => 3,
        'command' => described_class::START_COMMAND
      )
    end

    it 'workerが停止していればunhealthyを返すこと' do
      described_class.mark_running!(processed_count: 5)
      allow(described_class).to receive(:process_alive?).and_return(false)

      expect(described_class.current_status).to include(
        'status' => 'unhealthy',
        'processed_count' => 5,
        'reason' => 'worker_not_running'
      )
    end

    it '不正なJSONならheartbeat_missingとして扱うこと' do
      File.write(described_class::HEARTBEAT_PATH, '{invalid json')

      expect(described_class.current_status).to include(
        'status' => 'unhealthy',
        'reason' => 'heartbeat_missing'
      )
    end
  end
end
