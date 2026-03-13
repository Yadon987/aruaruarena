# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

RSpec.describe OpenAiAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }
  it_behaves_like 'base ai adapter inheritance'

  describe '定数' do
    it_behaves_like 'adapter constants',
                    {
                      PROMPT_PATH: 'app/prompts/nakao.txt',
                      BASE_URL: 'https://api.groq.com/openai/v1',
                      MODEL_NAME: 'llama-3.3-70b-versatile'
                    }
  end

  describe '初期化' do
    it_behaves_like 'adapter initialization', '中尾彬風'

    it '中尾彬風の自然な常体ルールを含むこと' do
      prompt = adapter.instance_variable_get(:@prompt)

      expect(prompt).to include('基本の終止形は「だね」「だな」「だよ」「かな」')
      expect(prompt).to include('文全体は常体で統一し、敬体（「です」「ます」）を混ぜないこと。')
      expect(prompt).to include('不自然な語尾は禁止。')
      expect(prompt).to include('声に出して不自然な語尾や文法のねじれがないか確認し')
    end
  end

  describe '#client' do
    it_behaves_like 'openai compatible client', 'https://api.groq.com/openai/v1'
  end

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }

    it_behaves_like 'openai compatible build request', 'llama-3.3-70b-versatile', 'nakao'

    it_behaves_like 'adapter build_request boundary', ->(req) { req[:messages].first[:content] }
  end

  describe '#parse_response' do
    it_behaves_like 'openai style parse response'
  end

  it_behaves_like 'adapter api key validation', 'GROQ_API_KEY'
  it_behaves_like 'secrets manager api key resolution',
                  secret_env_key: 'GROQ_SECRET_ARN',
                  legacy_env_key: 'GROQ_API_KEY'
end
