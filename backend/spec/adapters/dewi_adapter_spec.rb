# frozen_string_literal: true

require 'rails_helper'

# Issue: E06-05
RSpec.describe DewiAdapter, type: :model do
  include AdapterTestHelpers

  before(:each) do
    described_class.reset_prompt_cache! if defined?(described_class.reset_prompt_cache!)
  end

  let(:adapter) { described_class.new }
  it_behaves_like 'base ai adapter inheritance'

  describe '定数' do
    it_behaves_like 'adapter constants',
                    {
                      PROMPT_PATH: 'app/prompts/dewi.txt',
                      BASE_URL: 'https://api.cerebras.ai/v1',
                      MODEL_NAME: 'llama3.1-8b'
                    }
  end

  describe '初期化' do
    it_behaves_like 'adapter initialization', 'デヴィ婦人風'

    it 'デヴィ婦人風の自然な敬体ルールを含むこと' do
      prompt = adapter.instance_variable_get(:@prompt)

      expect(prompt).to include('基本の終止形は「ですわ」「ですこと」「ですの」「よろしくてよ」')
      expect(prompt).to include('他キャラの語尾や常体が混ざった不自然な語尾は禁止。')
      expect(prompt).to include('不自然なら自然なデヴィ婦人風の敬体に書き直すこと。')
    end
  end

  describe '#client' do
    it_behaves_like 'openai compatible client', 'https://api.cerebras.ai/v1'
  end

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }

    it_behaves_like 'openai compatible build request', 'llama3.1-8b', 'dewi'
  end

  describe '#parse_response' do
    it_behaves_like 'openai style parse response'
  end

  it_behaves_like 'adapter api key validation', 'CEREBRAS_API_KEY'
  it_behaves_like 'secrets manager api key resolution',
                  secret_env_key: 'CEREBRAS_SECRET_ARN',
                  legacy_env_key: 'CEREBRAS_API_KEY'

  describe '.reset_prompt_cache!' do
    it_behaves_like 'prompt cache reset'
  end
end
