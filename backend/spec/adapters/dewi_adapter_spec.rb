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
                      MODEL_NAME: 'llama-3.3-70b'
                    }
  end

  describe '初期化' do
    it_behaves_like 'adapter initialization', 'デヴィ婦人風'
  end

  describe '#client' do
    it_behaves_like 'openai compatible client', 'https://api.cerebras.ai/v1'
  end

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }

    it_behaves_like 'openai compatible build request', 'llama-3.3-70b', 'dewi'
  end

  describe '#parse_response' do
    it_behaves_like 'openai style parse response'
  end

  it_behaves_like 'adapter api key validation', 'CEREBRAS_API_KEY'

  describe '.reset_prompt_cache!' do
    it_behaves_like 'prompt cache reset'
  end
end
