RSpec.shared_examples 'GLM execute request error handling' do
  context 'エラーハンドリング' do
    it 'Faraday::TimeoutError発生時にログ出力して再送出すること' do
      allow(Rails.logger).to receive(:warn)
      allow(adapter.send(:client)).to receive(:post).and_raise(Faraday::TimeoutError.new('timeout'))

      expect { adapter.send(:execute_request, request_body) }.to raise_error(Faraday::TimeoutError)
      expect(Rails.logger).to have_received(:warn).with(/GLM APIタイムアウト/)
    end

    it 'Faraday::ConnectionFailed発生時にログ出力して再送出すること' do
      allow(Rails.logger).to receive(:error)
      allow(adapter.send(:client)).to receive(:post).and_raise(Faraday::ConnectionFailed.new('connection failed'))

      expect { adapter.send(:execute_request, request_body) }.to raise_error(Faraday::ConnectionFailed)
      expect(Rails.logger).to have_received(:error).with(/GLM API接続エラー/)
    end
  end
end
