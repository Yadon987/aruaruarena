# SimpleCovとRSpecの動作確認用テスト

require 'rails_helper'

RSpec.describe "SimpleCov Setup" do
  describe "動作確認" do
    it "SimpleCovが正しく設定されていること" do
      # このテストはSimpleCovの設定が正しく動作するか確認するためのもの
      expect(1 + 1).to eq(2)
    end

    it "RSpecが正しく動作すること" do
      expect(true).to be true
    end
  end
end
