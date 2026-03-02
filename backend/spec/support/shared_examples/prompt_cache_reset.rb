# frozen_string_literal: true

RSpec.shared_examples 'prompt cache reset' do
  it 'プロンプトキャッシュをリセットすること' do
    described_class.new
    described_class.reset_prompt_cache!

    expect(described_class.prompt_cache).to be_nil
  end
end
