# frozen_string_literal: true

require 'erb'

# OGPメタタグ生成サービス
# rubocop:disable Metrics/ClassLength
class OgpMetaTagService
  # 定数
  DEFAULT_OGP_IMAGE_PATH = '/ogp/default.png'
  MAX_DESCRIPTION_LENGTH = 200
  ELLIPSIS = '...'
  SITE_NAME = 'あるあるアリーナ'
  LOCALE = 'ja_JP'
  OG_TYPE = 'article'
  TWITTER_CARD = 'summary_large_image'
  IMAGE_WIDTH = 1200
  IMAGE_HEIGHT = 630
  OGP_S3_PREFIX = 'ogp/posts'
  S3_HEAD_TIMEOUT = 3
  UPLOADED_IMAGE_EXISTS_CACHE_TTL = 5.minutes

  # クローラー判定用キーワード
  CRAWLER_KEYWORDS = %w[
    twitterbot
    facebookexternalhit
    line-poker
    discordbot
    slackbot
    googlebot
    bingbot
    linkedinbot
    pinterest
    applebot
  ].freeze

  # User-Agentがクローラーかどうかを判定する
  #
  # @param user_agent [String, nil] User-Agent文字列
  # @return [Boolean] クローラーの場合はtrue
  def self.crawler?(user_agent:)
    return false if user_agent.nil? || user_agent.to_s.strip.empty?

    user_agent_str = user_agent.to_s.downcase
    CRAWLER_KEYWORDS.any? { |keyword| user_agent_str.include?(keyword) }
  end

  # OGPタグ付きHTMLを生成する
  #
  # @param post [Post] 投稿オブジェクト
  # @param base_url [String] ベースURL
  # @return [String, nil] HTML文字列
  def self.generate_html(post:, base_url:)
    return nil if post.nil?

    # 末尾のスラッシュを削除して正規化
    normalized_base_url = base_url.chomp('/')
    image_url = ogp_image_url(post:, base_url: normalized_base_url)

    # HTMLテンプレートを構築
    # XSS対策: テキスト部分は必ず escape_html を通すこと
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta property="og:title" content="#{escape_html(post.nickname || '')}さんのあるある投稿 | #{SITE_NAME}">
        <meta property="og:type" content="#{OG_TYPE}">
        <meta property="og:url" content="#{normalized_base_url}/posts/#{post.id}">
        <meta property="og:image" content="#{image_url}">
        <meta property="og:image:width" content="#{IMAGE_WIDTH}">
        <meta property="og:image:height" content="#{IMAGE_HEIGHT}">
        <meta property="og:description" content="#{escape_html(generate_description(body: post.body, average_score: post.average_score))}">
        <meta property="og:site_name" content="#{SITE_NAME}">
        <meta property="og:locale" content="#{LOCALE}">
        <meta name="twitter:card" content="#{TWITTER_CARD}">
        <meta name="twitter:title" content="#{escape_html(post.nickname || '')}さんのあるある投稿 | #{SITE_NAME}">
        <meta name="twitter:description" content="#{escape_html(generate_description(body: post.body, average_score: post.average_score))}">
        <meta name="twitter:image" content="#{image_url}">
      </head>
      <body></body>
      </html>
    HTML
  end

  def self.ogp_image_url(post:, base_url:)
    normalized_base_url = base_url.chomp('/')
    return generated_image_url(post:, base_url: normalized_base_url) if ogp_s3_bucket.blank?
    return generated_image_url(post:, base_url: normalized_base_url) if uploaded_image_exists?(post:)

    Rails.logger.warn("[OgpMetaTagService] 生成済みOGP画像が見つからないためデフォルト画像へフォールバック: post_id=#{post.id}")
    default_image_url(base_url: normalized_base_url)
  end

  # 説明文（og:description）を生成する
  #
  # @param body [String] 投稿本文
  # @param average_score [Float, nil] 平均スコア
  # @return [String] 生成された説明文
  def self.generate_description(body:, average_score:)
    description = body.to_s
    score_text = if average_score.nil?
                   ' (スコア: 未評価)'
                 else
                   # 小数点以下が0の場合は整数表示、それ以外は小数第1位まで表示
                   # 例: 100.0 -> 100, 85.5 -> 85.5
                   formatted_score = (average_score % 1).zero? ? average_score.to_i : format('%.1f', average_score)
                   " (スコア: #{formatted_score}点)"
                 end

    # スコア部分の長さを考慮して本文を省略
    score_length = score_text.length
    available_length = MAX_DESCRIPTION_LENGTH - score_length

    # 本文が空の場合はスコアのみ返すなどのガードは truncate_description 内で行われるが、
    # available_length が負になることは理論上あり得ない（MAX=200, score_textは短い）
    truncated_body = truncate_description(text: description, max_length: available_length)

    "#{truncated_body}#{score_text}"
  end

  # HTMLエスケープを行う
  #
  # @param text [String, nil] エスケープ対象の文字列
  # @return [String] エスケープ後の文字列
  def self.escape_html(text)
    return '' if text.nil?

    # 標準ライブラリを使用して安全かつ簡潔に実装
    ERB::Util.html_escape(text)
  end

  def self.uploaded_image_exists?(post:)
    Rails.cache.fetch(uploaded_image_exists_cache_key(post), expires_in: UPLOADED_IMAGE_EXISTS_CACHE_TTL) do
      build_s3_client.head_object(bucket: ogp_s3_bucket, key: object_key(post))
      true
    rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
      false
    rescue Aws::S3::Errors::ServiceError => e
      Rails.logger.warn("[OgpMetaTagService] OGP画像存在確認に失敗: post_id=#{post.id} error=#{e.class} - #{e.message}")
      false
    rescue StandardError => e
      Rails.logger.warn("[OgpMetaTagService] OGP画像存在確認で予期しない例外: post_id=#{post.id} error=#{e.class} - #{e.message}")
      false
    end
  end

  # 文字列を指定した長さで省略する
  #
  # @param text [String] 対象文字列
  # @param max_length [Integer] 最大長
  # @return [String] 省略後の文字列
  def self.truncate_description(text:, max_length:)
    return '' if text.nil? || max_length <= 0

    text_str = text.to_s
    return text_str if text_str.length <= max_length

    # 省略記号より短い制限の場合はそのまま切り詰める（エッジケース対策）
    ellipsis_length = ELLIPSIS.length
    return text_str[0...max_length] if max_length <= ellipsis_length

    truncated = text_str[0...(max_length - ellipsis_length)]
    "#{truncated}#{ELLIPSIS}"
  end

  def self.default_image_url(base_url:)
    "#{base_url}#{DEFAULT_OGP_IMAGE_PATH}"
  end

  def self.generated_image_url(post:, base_url:)
    "#{base_url}/#{object_key(post)}"
  end

  def self.object_key(post)
    "#{OGP_S3_PREFIX}/#{post.id}.png"
  end

  def self.uploaded_image_exists_cache_key(post)
    "ogp_meta_tag_service/uploaded_image_exists/#{object_key(post)}"
  end

  def self.ogp_s3_bucket
    ENV.fetch('OGP_S3_BUCKET', '').strip
  end

  def self.build_s3_client
    Aws::S3::Client.new(
      region: ENV.fetch('AWS_REGION', 'ap-northeast-1'),
      http_open_timeout: S3_HEAD_TIMEOUT,
      http_read_timeout: S3_HEAD_TIMEOUT
    )
  end
end
# rubocop:enable Metrics/ClassLength
