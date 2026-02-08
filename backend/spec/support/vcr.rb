# VCR（Video Cassette Recorder）の設定
# 外部API（Gemini, GLM, OpenAI）のモックに使用

require 'vcr'

VCR.configure do |config|
  # カセット（録音データ）の保存先
  config.cassette_library_dir = 'spec/fixtures/vcr_cassettes'

  # WebMockをフックしてHTTPリクエストを録音
  config.hook_into :webmock

  # デフォルトで録音モード（:once: 新規なら録音、既存なら再生）
  config.default_cassette_options = {
    record: :once,
    match_requests_on: [:method, :uri, :body]
  }

  # DynamoDB Localへのリクエストを無視
  config.ignore_localhost = true

  # 機密情報のフィルタリング
  config.filter_sensitive_data('<GEMINI_API_KEY>') { ENV['GEMINI_API_KEY'] }
  config.filter_sensitive_data('<GLM_API_KEY>') { ENV['GLM_API_KEY'] }
  config.filter_sensitive_data('<OPENAI_API_KEY>') { ENV['OPENAI_API_KEY'] }

  # カセットがない場合の挙動
  config.configure_rspec_metadata!
end

# RSpecで:vcrタグが付いているテストでVCRを有効化
RSpec.configure do |config|
  config.around(:each, :vcr) do |example|
    # カセット名を自動生成（例: "spec/requests/api/posts_spec.rb:15" → "posts_spec/15"）
    cassette_name = example.full_description.downcase.gsub(/\s+/, '_').gsub(/[^a-z0-9_]/, '')
    VCR.use_cassette(cassette_name, &example)
  end
end
