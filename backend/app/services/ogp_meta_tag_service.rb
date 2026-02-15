# frozen_string_literal: true

require 'erb'

# OGPメタタグ生成サービス
class OgpMetaTagService
  # 定数
  DEFAULT_OGP_IMAGE_PATH = '/ogp/default.png'
  MAX_DESCRIPTION_LENGTH = 200
  ELLIPSIS = '...'
  SITE_NAME = 'あるあるアリーナ'
  LOCALE = 'ja_JP'
  OG_TYPE = 'article'
  TWITTER_CARD = 'summary_large_image'

  # クローラー判定用キーワード
  CRAWLER_KEYWORDS = %w[twitterbot facebookexternalhit line-poker discordbot slackbot].freeze

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
        <meta property="og:image" content="#{normalized_base_url}/ogp/posts/#{post.id}.png">
        <meta property="og:description" content="#{escape_html(generate_description(body: post.body, average_score: post.average_score))}">
        <meta property="og:site_name" content="#{SITE_NAME}">
        <meta property="og:locale" content="#{LOCALE}">
        <meta name="twitter:card" content="#{TWITTER_CARD}">
      </head>
      <body></body>
      </html>
    HTML
  end

  # 説明文（og:description）を生成する
  #
  # @param body [String] 投稿本文
  # @param average_score [Float, nil] 平均スコア
  # @return [String] 生成された説明文
  def self.generate_description(body:, average_score:)
    description = body.to_s
    score_text = if average_score.nil?
                   ' (スコア: 点)'
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
    if max_length <= ellipsis_length
      return text_str[0...max_length]
    end

    truncated = text_str[0...(max_length - ellipsis_length)]
    "#{truncated}#{ELLIPSIS}"
  end
end
