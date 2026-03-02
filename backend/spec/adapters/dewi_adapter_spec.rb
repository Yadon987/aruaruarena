# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

# Issue: E06-05
RSpec.describe DewiAdapter, type: :model do
  before(:each) do
    described_class.reset_prompt_cache! if defined?(described_class.reset_prompt_cache!)
  end

  let(:adapter) { described_class.new }
  it_behaves_like 'base ai adapter inheritance'

  describe '定数' do
    it_behaves_like 'adapter constants', { PROMPT_PATH: 'app/prompts/dewi.txt' }
  end

  describe '初期化' do
    it_behaves_like 'adapter initialization', 'デヴィ婦人風'
  end

  describe '#client' do
    it_behaves_like 'glm client', 'https://open.bigmodel.cn/api/paas/v4/'
  end

  it_behaves_like 'adapter api key validation', 'GLM_API_KEY'

  describe '#build_request' do
    let(:post_content) { 'テスト投稿' }

    it_behaves_like 'openai compatible build request', 'glm-4-flash', 'dewi'
  end

  describe '#parse_response' do
    it_behaves_like 'openai style parse response'
  end

  describe '.reset_prompt_cache!' do
    it_behaves_like 'prompt cache reset'
  end

  describe '#execute_request' do
    let(:request_body) { { model: 'glm-4-flash', messages: [] } }

    it_behaves_like 'GLM execute request error handling'
  end

  describe '#handle_response_status' do
    it_behaves_like 'GLM response status handling'
  end
end
