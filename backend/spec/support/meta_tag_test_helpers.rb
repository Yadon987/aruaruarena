# frozen_string_literal: true

# メタタグテスト用モックヘルパー
module MetaTagTestHelpers
  # 何を検証するか: クローラー判定の環境変数を設定する
  def setup_crawler_env
    allow(ENV).to receive(:fetch).with('CRAWLER_USER_AGENTS')
                                 .and_return('Twitterbot,facebookexternalhit,line-poker,Discordbot,Slackbot')
  end

  # 何を検証するか: クローラー判定の環境変数をクリアする
  def clear_crawler_env
    allow(ENV).to receive(:fetch).with('CRAWLER_USER_AGENTS')
                                 .and_raise(KeyError, 'CRAWLER_USER_AGENTS not set')
  end

  # 何を検証するか: DynamoDBアクセス失敗のモックを設定する
  def setup_dynamodb_error_mock(error_class = Aws::DynamoDB::Errors::ServiceError)
    allow(Post).to receive(:find).and_raise(error_class.new(nil, 'Service unavailable'))
  end

  # 何を検証するか: OGP画像生成サービスのモックを設定する
  def setup_ogp_service_mock(image_data = nil)
    allow(OgpGeneratorService).to receive(:call).and_return(image_data)
  end

  # 何を検証するか: OGP画像生成失敗のモックを設定する
  def setup_ogp_service_failure_mock
    allow(OgpGeneratorService).to receive(:call).and_return(nil)
  end

  # 何を検証するか: 投稿取得のモックを設定する
  def setup_post_find_mock(post)
    allow(Post).to receive(:find).and_return(post)
  end

  # 何を検証するか: 投稿取得失敗のモックを設定する
  def setup_post_find_failure_mock
    allow(Post).to receive(:find).and_raise(Dynamoid::Errors::RecordNotFound)
  end

  # 何を検証するか: HTMLレスポンスのメタタグを抽出する
  def extract_meta_tags(html, property)
    html.scan(/<meta[^>]*property=["']#{property}["'][^>]*>/)
  end

  # 何を検証するか: HTMLレスポンスのメタタグのcontent属性を抽出する
  def extract_meta_tag_content(html, property)
    meta_tag = html.match(/<meta[^>]*property=["']#{property}["'][^>]*content=["']([^"']+)["']/)
    meta_tag ? meta_tag[1] : nil
  end

  # 何を検証するか: HTMLエスケープ済みか検証する
  def assert_html_escaped(html, unsafe_string)
    escaped_string = CGI.escapeHTML(unsafe_string)
    expect(html).to include(escaped_string)
    expect(html).not_to include(unsafe_string)
  end
end

RSpec.configure do |config|
  config.include MetaTagTestHelpers, type: :service
  config.include MetaTagTestHelpers, type: :request
end
