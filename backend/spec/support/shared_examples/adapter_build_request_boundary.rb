RSpec.shared_examples 'adapter build_request boundary' do |content_extractor|
  let(:adapter) { described_class.new }
  let(:persona) { 'test_persona' }

  context '境界値テスト' do
    it 'JSON制御文字が含まれていても正しくエスケープされること' do
      complex_content = 'Test with "quotes" and \backslashes'
      request = adapter.send(:build_request, complex_content, persona)

      content = content_extractor.call(request)
      expect(content).to include('Test with "quotes" and \backslashes')
    end

    it '特殊文字が含まれていても正しく処理されること' do
      special_chars = '!@#$%^&*()_+{}|:<>?~`'
      request = adapter.send(:build_request, special_chars, persona)

      content = content_extractor.call(request)
      expect(content).to include(special_chars)
    end

    it '改行が含まれていても正しく処理されること' do
      multi_line = "Line 1\nLine 2\r\nLine 3"
      request = adapter.send(:build_request, multi_line, persona)

      content = content_extractor.call(request)
      expect(content).to include("Line 1\nLine 2\r\nLine 3")
    end

    it '絵文字が含まれていても正しく処理されること' do
      emoji_content = 'Hello 🌍 👋'
      request = adapter.send(:build_request, emoji_content, persona)

      content = content_extractor.call(request)
      expect(content).to include(emoji_content)
    end
  end
end
