# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health Check', type: :request do
  describe 'GET /health' do
    context '必須環境変数が設定されている場合' do
      before do
        ENV['SECRET_KEY_BASE'] = 'test_secret'
        ENV['DYNAMODB_TABLE_POSTS'] = 'test_table'
        ENV['SQS_QUEUE_URL'] = 'https://sqs.test'
        ENV['GEMINI_API_KEY'] = 'test_gemini'
        ENV['CEREBRAS_API_KEY'] = 'test_cerebras'
        ENV['GROQ_API_KEY'] = 'test_groq'
      end

      after do
        ENV.delete('SECRET_KEY_BASE') if ENV['SECRET_KEY_BASE'] == 'test_secret'
        ENV.delete('DYNAMODB_TABLE_POSTS') if ENV['DYNAMODB_TABLE_POSTS'] == 'test_table'
        ENV.delete('SQS_QUEUE_URL') if ENV['SQS_QUEUE_URL'] == 'https://sqs.test'
        ENV.delete('GEMINI_API_KEY') if ENV['GEMINI_API_KEY'] == 'test_gemini'
        ENV.delete('CEREBRAS_API_KEY') if ENV['CEREBRAS_API_KEY'] == 'test_cerebras'
        ENV.delete('GROQ_API_KEY') if ENV['GROQ_API_KEY'] == 'test_groq'
      end

      it 'ステータスOKを返すこと' do
        get '/health'
        expect(response).to have_http_status(:ok)

        json = response.parsed_body
        expect(json['status']).to eq('ok')
        expect(json['environment']).to be_present
        expect(json['timestamp']).to be_present
      end
    end

    context 'ローカルワーカーモードの場合' do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new('development'))
        ENV['SECRET_KEY_BASE'] = 'test_secret'
        ENV['DYNAMODB_TABLE_POSTS'] = 'test_table'
        ENV.delete('SQS_QUEUE_URL')
        ENV['GEMINI_API_KEY'] = 'test_gemini'
        ENV['CEREBRAS_API_KEY'] = 'test_cerebras'
        ENV['GROQ_API_KEY'] = 'test_groq'
        ENV['LOCAL_JUDGE_WORKER'] = 'true'
      end

      after do
        ENV.delete('SECRET_KEY_BASE') if ENV['SECRET_KEY_BASE'] == 'test_secret'
        ENV.delete('DYNAMODB_TABLE_POSTS') if ENV['DYNAMODB_TABLE_POSTS'] == 'test_table'
        ENV.delete('GEMINI_API_KEY') if ENV['GEMINI_API_KEY'] == 'test_gemini'
        ENV.delete('CEREBRAS_API_KEY') if ENV['CEREBRAS_API_KEY'] == 'test_cerebras'
        ENV.delete('GROQ_API_KEY') if ENV['GROQ_API_KEY'] == 'test_groq'
        ENV.delete('LOCAL_JUDGE_WORKER')
      end

      it 'ワーカー稼働中なら SQS_QUEUE_URL が未設定でもステータスOKを返すこと' do
        allow(LocalJudgmentWorkerHeartbeatService).to receive(:current_status).and_return({
          'mode' => 'local_worker',
          'status' => 'ok',
          'pid' => 12_345,
          'updated_at' => '2026-03-12T07:00:00+09:00',
          'command' => 'bundle exec ruby scripts/run_judgment_worker.rb'
        })

        get '/health'
        expect(response).to have_http_status(:ok)

        json = response.parsed_body
        expect(json['worker']).to include(
          'mode' => 'local_worker',
          'status' => 'ok'
        )
      end

      it 'ワーカー停止中ならステータス503を返すこと' do
        allow(LocalJudgmentWorkerHeartbeatService).to receive(:current_status).and_return({
          'mode' => 'local_worker',
          'status' => 'unhealthy',
          'reason' => 'heartbeat_missing',
          'command' => 'bundle exec ruby scripts/run_judgment_worker.rb'
        })

        get '/health'
        expect(response).to have_http_status(:service_unavailable)

        json = response.parsed_body
        expect(json['status']).to eq('unhealthy')
        expect(json['error']).to eq('Local judgment worker is not running')
        expect(json['worker']).to include(
          'mode' => 'local_worker',
          'status' => 'unhealthy',
          'reason' => 'heartbeat_missing'
        )
      end
    end

    context '必須環境変数が欠落している場合' do
      before do
        ENV['SECRET_KEY_BASE'] = 'test_secret'
        ENV.delete('DYNAMODB_TABLE_POSTS')
        ENV.delete('SQS_QUEUE_URL')
        ENV.delete('GEMINI_API_KEY')
        ENV.delete('CEREBRAS_API_KEY')
        ENV.delete('GROQ_API_KEY')
      end

      after do
        ENV.delete('SECRET_KEY_BASE') if ENV['SECRET_KEY_BASE'] == 'test_secret'
      end

      it 'ステータス503を返すこと' do
        get '/health'
        expect(response).to have_http_status(:service_unavailable)

        json = response.parsed_body
        expect(json['status']).to eq('unhealthy')
        expect(json['error']).to eq('Missing required environment variables')
        expect(json['missing']).to be_present
      end
    end
  end
end
