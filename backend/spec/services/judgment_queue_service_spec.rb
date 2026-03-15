# frozen_string_literal: true

require 'rails_helper'
require 'timeout'

RSpec.describe JudgmentQueueService, dynamodb: false do
  shared_context 'SQS mocks' do
    let(:queue_url) { 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/judgment-queue' }
    let(:http_response) { instance_double(Net::HTTPSuccess, body: '', code: '200') }
    let(:http_client) { instance_double(Net::HTTP) }
    let(:signer) { instance_double(Aws::Sigv4::Signer) }
    let(:signed_request) { instance_double(Aws::Sigv4::Signature, headers: { 'Authorization' => 'signed' }) }

    before do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('SQS_QUEUE_URL').and_return(queue_url)
      allow(ENV).to receive(:fetch).with('AWS_REGION', 'ap-northeast-1').and_return('ap-northeast-1')
      allow(ENV).to receive(:fetch).with('AWS_ACCESS_KEY_ID').and_return('access-key')
      allow(ENV).to receive(:fetch).with('AWS_SECRET_ACCESS_KEY').and_return('secret-key')
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('AWS_SESSION_TOKEN').and_return('session-token')

      allow(Aws::Sigv4::Signer).to receive(:new).and_return(signer)
      allow(signer).to receive(:sign_request).and_return(signed_request)
      allow(Net::HTTP).to receive(:start).and_yield(http_client)
      allow(http_client).to receive(:request).and_return(http_response)
      allow(http_response).to receive(:is_a?).with(Net::HTTPSuccess).and_return(true)
    end
  end

  describe '.enqueue' do
    include_context 'SQS mocks'

    it 'post_id を含む JSON を SQS へ送信すること' do
      described_class.enqueue('post-123')

      expect(signer).to have_received(:sign_request).with(
        hash_including(
          body: include(
            'MessageBody=%7B%22post_id%22%3A%22post-123%22%2C%22job_type%22%3A%22judge_post%22%7D'
          )
        )
      )
      expect(http_client).to have_received(:request).with(instance_of(Net::HTTP::Post))
    end

    it 'SQS_QUEUE_URL 未設定時は例外を送出すること' do
      allow(ENV).to receive(:fetch).with('SQS_QUEUE_URL').and_yield

      expect { described_class.enqueue('post-123') }.to raise_error(RuntimeError, 'SQS_QUEUE_URL が設定されていません')
    end

    it 'ローカルワーカーモードでは SQS へ送信しないこと' do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new('development'))
      allow(ENV).to receive(:[]).with('LOCAL_JUDGE_WORKER').and_return('true')
      allow(LocalJudgmentWorkerHeartbeatService).to receive(:current_status).and_return({
                                                                                          'status' => 'ok'
                                                                                        })

      described_class.enqueue('post-123')

      expect(http_client).not_to have_received(:request)
    end

    it 'ローカルワーカー未起動時は非同期フォールバックで審査を開始すること' do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new('development'))
      allow(ENV).to receive(:[]).with('LOCAL_JUDGE_WORKER').and_return('true')
      allow(LocalJudgmentWorkerHeartbeatService).to receive(:current_status).and_return({
                                                                                          'status' => 'unhealthy'
                                                                                        })
      called = false
      allow(JudgePostService).to receive(:call) do
        called = true
      end

      described_class.enqueue('post-123')

      Timeout.timeout(1) do
        sleep 0.01 until called
      end

      expect(JudgePostService).to have_received(:call).with('post-123')
      expect(http_client).not_to have_received(:request)
    end
  end

  describe '.enqueue_ogp_generation' do
    include_context 'SQS mocks'

    it 'OGP生成ジョブを SQS へ送信すること' do
      described_class.enqueue_ogp_generation('post-123')

      expect(signer).to have_received(:sign_request).with(
        hash_including(
          body: include(
            'MessageBody=%7B%22post_id%22%3A%22post-123%22%2C%22job_type%22%3A%22generate_ogp%22%7D'
          )
        )
      )
    end
  end
end
