# frozen_string_literal: true

RSpec.shared_examples 'base ai adapter inheritance' do
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end
end
