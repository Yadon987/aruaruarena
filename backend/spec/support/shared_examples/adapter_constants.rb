# frozen_string_literal: true

RSpec.shared_examples 'adapter constants' do |expected_constants|
  it '必要な定数が正しく定義されていること', :aggregate_failures do
    expected_constants.each do |constant_name, expected_value|
      expect(described_class.const_get(constant_name)).to eq(expected_value)
    end
  end
end
