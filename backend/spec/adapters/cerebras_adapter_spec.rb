# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CerebrasAdapter do
  include AdapterTestHelpers

  let(:adapter) { described_class.new }
  it_behaves_like 'base ai adapter inheritance'

  describe '定数' do
    it_behaves_like 'adapter constants',
                    {
                      PROMPT_PATH: 'app/prompts/dewi.txt',
                      BASE_URL: 'https://api.cerebras.ai/v1',
                      MODEL_NAME: 'gpt-oss-120b'
                    }
  end

  describe '#client' do
    it_behaves_like 'openai compatible client', 'https://api.cerebras.ai/v1'
  end

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }

    it_behaves_like 'openai compatible build request', 'gpt-oss-120b', 'dewi'
  end

  describe '#parse_response' do
    it_behaves_like 'openai style parse response'
  end

  it_behaves_like 'adapter api key validation', 'CEREBRAS_API_KEY'
  it_behaves_like 'secrets manager api key resolution',
                  secret_env_key: 'CEREBRAS_SECRET_ARN',
                  legacy_env_key: 'CEREBRAS_API_KEY'
end
