# frozen_string_literal: true

RSpec.shared_examples 'glm client' do |expected_base_url|
  it 'Faraday::Connectionインスタンスを返すこと', :aggregate_failures do
    client = adapter.send(:client)

    expect(client).to be_a(Faraday::Connection)
    expect(client.url_prefix.to_s).to eq(expected_base_url)
    expect(client.options.timeout).to eq(20)
  end
end
