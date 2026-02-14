# frozen_string_literal: true

RSpec.shared_examples 'GLM response status handling' do
  # AdapterTestHelpersのbuild_http_responseを使用

  context 'HTTPステータス別処理' do
    it '200番台でレスポンスを返すこと' do
      allow(Rails.logger).to receive(:info)
      response = build_http_response(200, { result: 'ok' })

      result = adapter.send(:handle_response_status, response)
      expect(result).to eq(response)
      expect(Rails.logger).to have_received(:info).with('GLM API呼び出し成功')
    end

    it '201でレスポンスを返すこと' do
      allow(Rails.logger).to receive(:info)
      response = build_http_response(201)

      result = adapter.send(:handle_response_status, response)
      expect(result).to eq(response)
    end

    it '429でFaraday::ClientErrorを発生させること' do
      allow(Rails.logger).to receive(:warn)
      response = build_http_response(429, { error: 'rate limit' })

      expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
      expect(Rails.logger).to have_received(:warn).with(/GLM APIレート制限/)
    end

    it '400でFaraday::ClientErrorを発生させること' do
      allow(Rails.logger).to receive(:error)
      response = build_http_response(400, { error: 'bad request' })

      expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
      expect(Rails.logger).to have_received(:error).with(/GLM APIクライアントエラー/)
    end

    it '404でFaraday::ClientErrorを発生させること' do
      allow(Rails.logger).to receive(:error)
      response = build_http_response(404, { error: 'not found' })

      expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
    end

    it '500でFaraday::ServerErrorを発生させること' do
      allow(Rails.logger).to receive(:error)
      response = build_http_response(500, { error: 'internal error' })

      expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ServerError)
      expect(Rails.logger).to have_received(:error).with(/GLM APIサーバーエラー/)
    end

    it '503でFaraday::ServerErrorを発生させること' do
      allow(Rails.logger).to receive(:error)
      response = build_http_response(503, { error: 'service unavailable' })

      expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ServerError)
    end

    it 'その他のステータス（例: 301）でFaraday::ClientErrorを発生させること' do
      allow(Rails.logger).to receive(:error)
      response = build_http_response(301, { error: 'redirect' })

      expect { adapter.send(:handle_response_status, response) }.to raise_error(Faraday::ClientError)
      expect(Rails.logger).to have_received(:error).with(/GLM API未知のエラー/)
    end
  end
end
