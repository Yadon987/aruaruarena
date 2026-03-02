# frozen_string_literal: true

RSpec.shared_examples 'openai compatible build request' do |expected_model, persona|
  it 'OpenAI互換のリクエスト形式であること', :aggregate_failures do
    request = adapter.send(:build_request, post_content, persona)

    expect(request).to be_a(Hash)
    expect(request[:model]).to eq(expected_model)
    expect(request[:messages]).to be_an(Array)
    expect(request[:messages].first[:role]).to eq('user')
    expect(request[:messages].first[:content]).to include(post_content)
    expect(request[:messages].first[:content]).not_to include('{post_content}')
    expect(request[:temperature]).to eq(0.7)
    expect(request[:max_tokens]).to eq(1000)
  end
end
