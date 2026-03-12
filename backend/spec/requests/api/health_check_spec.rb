# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::HealthCheck', type: :request do
  describe 'GET /api/health' do
    context '必須環境変数が設定されている場合' do
      before do
        # 実際に環境変数を設定
        ENV['SECRET_KEY_BASE'] = 'test_secret'
        ENV['DYNAMODB_TABLE_POSTS'] = 'test_table'
        ENV['SQS_QUEUE_URL'] = 'https://sqs.test'
        ENV['GEMINI_API_KEY'] = 'test_gemini'
        ENV['CEREBRAS_API_KEY'] = 'test_cerebras'
        ENV['GROQ_API_KEY'] = 'test_groq'
      end

      after do
        # テスト後にクリーンアップ
        ENV.delete('SECRET_KEY_BASE') if ENV['SECRET_KEY_BASE'] == 'test_secret'
        ENV.delete('DYNAMODB_TABLE_POSTS') if ENV['DYNAMODB_TABLE_POSTS'] == 'test_table'
        ENV.delete('SQS_QUEUE_URL') if ENV['SQS_QUEUE_URL'] == 'https://sqs.test'
        ENV.delete('GEMINI_API_KEY') if ENV['GEMINI_API_KEY'] == 'test_gemini'
        ENV.delete('CEREBRAS_API_KEY') if ENV['CEREBRAS_API_KEY'] == 'test_cerebras'
        ENV.delete('GROQ_API_KEY') if ENV['GROQ_API_KEY'] == 'test_groq'
      end

      it 'ステータスOKを返すこと' do
        get '/api/health'
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

        get '/api/health'
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

        get '/api/health'
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
        # 一部の環境変数を未設定にする
        ENV['SECRET_KEY_BASE'] = 'test_secret'
        ENV['DYNAMODB_TABLE_POSTS'] = ''
        ENV.delete('SQS_QUEUE_URL')
        ENV['GEMINI_API_KEY'] = 'test_gemini'
        ENV['CEREBRAS_API_KEY'] = ''
        ENV['GROQ_API_KEY'] = 'test_groq'
      end

      after do
        ENV.delete('SECRET_KEY_BASE') if ENV['SECRET_KEY_BASE'] == 'test_secret'
        ENV.delete('DYNAMODB_TABLE_POSTS')
        ENV.delete('GEMINI_API_KEY') if ENV['GEMINI_API_KEY'] == 'test_gemini'
        ENV.delete('CEREBRAS_API_KEY')
        ENV.delete('GROQ_API_KEY') if ENV['GROQ_API_KEY'] == 'test_groq'
      end

      it 'ステータス503と欠落環境変数情報を返すこと' do
        get '/api/health'
        expect(response).to have_http_status(:service_unavailable)

        json = response.parsed_body
        expect(json['status']).to eq('unhealthy')
        expect(json['error']).to eq('Missing required environment variables')
        expect(json['missing']).to contain_exactly('DYNAMODB_TABLE_POSTS', 'SQS_QUEUE_URL', 'CEREBRAS_API_KEY')
        expect(json['timestamp']).to be_present
      end
    end

    context 'Secrets Managerが有効な場合' do
      before do
        ENV['SECRETS_MANAGER_ENABLED'] = 'true'
        ENV['SECRET_KEY_BASE'] = 'test_secret'
        ENV['DYNAMODB_TABLE_POSTS'] = 'test_table'
        ENV['SQS_QUEUE_URL'] = 'https://sqs.test'
        ENV['GEMINI_API_KEY'] = ''
        ENV['CEREBRAS_API_KEY'] = ''
        ENV['GROQ_API_KEY'] = ''
        ENV['GEMINI_SECRET_ARN'] = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:aruaruarena/ai-keys/gemini-dev-AbCd12'
        ENV['CEREBRAS_SECRET_ARN'] = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:aruaruarena/ai-keys/cerebras-dev-AbCd12'
        ENV['GROQ_SECRET_ARN'] = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:aruaruarena/ai-keys/groq-dev-AbCd12'
        allow(SecretsManagerClient).to receive(:get_api_key).and_return('resolved-key')
      end

      after do
        ENV.delete('SECRETS_MANAGER_ENABLED')
        ENV.delete('SECRET_KEY_BASE') if ENV['SECRET_KEY_BASE'] == 'test_secret'
        ENV.delete('DYNAMODB_TABLE_POSTS') if ENV['DYNAMODB_TABLE_POSTS'] == 'test_table'
        ENV.delete('SQS_QUEUE_URL') if ENV['SQS_QUEUE_URL'] == 'https://sqs.test'
        ENV.delete('GEMINI_API_KEY')
        ENV.delete('CEREBRAS_API_KEY')
        ENV.delete('GROQ_API_KEY')
        ENV.delete('GEMINI_SECRET_ARN')
        ENV.delete('CEREBRAS_SECRET_ARN')
        ENV.delete('GROQ_SECRET_ARN')
      end

      it 'APIキー本体が空でもSecrets Managerで解決できればステータスOKを返すこと' do
        get '/api/health'

        expect(response).to have_http_status(:ok)
        expect(SecretsManagerClient).to have_received(:get_api_key).with(
          secret_arn: ENV['GEMINI_SECRET_ARN'],
          env_key: 'GEMINI_API_KEY'
        )
      end
    end
  end
end
