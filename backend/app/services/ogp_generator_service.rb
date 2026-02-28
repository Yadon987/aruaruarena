# frozen_string_literal: true

# OGP画像生成サービス
# rubocop:disable Metrics/ClassLength
class OgpGeneratorService
  IMAGE_WIDTH = 1200
  IMAGE_HEIGHT = 630
  IMAGE_FORMAT = 'PNG'
  # 仕様書で定義されている表示上限。切り詰め自体は別Issueで扱う。
  MAX_NICKNAME_LENGTH = 20
  MAX_BODY_LENGTH = 50
  SCORE_DEFAULT = 0

  BASE_IMAGE_PATH = Rails.root.join('app/assets/images/base_ogp.png')
  FONT_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Regular.otf')
  FONT_BOLD_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Bold.otf')
  REQUIRED_FILES = [BASE_IMAGE_PATH, FONT_PATH, FONT_BOLD_PATH].freeze

  # 画像レイアウト定数
  LAYOUT = {
    # テキスト描画位置
    nickname: { x: 100, y: 100 },
    body: { x: 100, y: 160 },
    score: { x: 900, y: 100 },
    rank: { x: 900, y: 180 }
  }.freeze

  # フォントサイズ定数
  FONT_SIZES = {
    nickname: 48,
    body: 36,
    score: 72,
    rank: 36
  }.freeze

  # テキスト色定数
  TEXT_COLORS = {
    primary: '#333333',
    score: '#FF6B6B',
    secondary: '#666666'
  }.freeze

  # テキスト定数
  TEXT_CONFIG = {
    # テキストフォーマット
    rank_prefix: '第',
    rank_suffix: '位',
    out_of_rank: '圏外',
    score_suffix: '点'
  }.freeze

  def initialize(post_id)
    @post = Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[OgpGeneratorService] Post not found: #{post_id}")
    @post = nil
  end

  # rubocop:disable Metrics/MethodLength
  def execute
    return nil unless valid_post?
    return nil unless ensure_resources_exist?

    image = create_base_image
    return nil if image.nil?

    draw_post_info(image)

    log_success
    image.to_blob
  rescue MiniMagick::Error => e
    log_error("Image generation failed: #{e.message}")
    nil
  rescue StandardError => e
    log_error("Unexpected error: #{e.class} - #{e.message}")
    nil
  end
  # rubocop:enable Metrics/MethodLength

  class << self
    def call(post_id)
      new(post_id).execute
    end
  end

  private

  # 投稿が有効か判定する（存在確認とステータスチェック）
  def valid_post?
    @post.present? && @post.status == Post::STATUS_SCORED
  end

  # ベース画像を作成する（ファイル存在チェックを含む）
  def create_base_image
    return nil unless ensure_resources_exist?

    MiniMagick::Image.open(BASE_IMAGE_PATH)
  rescue MiniMagick::Error => e
    log_error("Failed to open base image: #{e.message}")
    nil
  end

  # すべての必須ファイルが存在するか確認する
  def ensure_resources_exist?
    # ImageMagick実行前にfail-fastすることで、外部コマンド実行後の曖昧な失敗を避ける。
    missing_file = REQUIRED_FILES.find { |path| !file_exists?(path) }
    return true if missing_file.nil?

    log_error("#{resource_label(missing_file)} not found: #{missing_file}")
    false
  end

  # 投稿情報（ニックネーム・本文・スコア・ランキング）を描画する
  def draw_post_info(image)
    build_post_draw_items.each do |item|
      draw_text(image, item[:text], item[:size], item[:color], item[:x], item[:y], item[:font])
    end
  end

  # ファイル存在確認で例外が起きても生成フロー全体は落とさない
  def file_exists?(path)
    File.exist?(path.to_s)
  rescue StandardError => e
    Rails.logger.warn("[OgpGeneratorService] File.exist? error: #{e.message}")
    false
  end

  # ランキング取得失敗時はOGP生成自体を止めず、「圏外」でフォールバックする。
  def calculate_rank_with_fallback
    @post.calculate_rank
  rescue StandardError => e
    log_warn("Failed to calculate rank: #{e.message}")
    nil
  end

  def build_rank_text(rank)
    return TEXT_CONFIG[:out_of_rank] if rank.nil?

    "#{TEXT_CONFIG[:rank_prefix]}#{rank}#{TEXT_CONFIG[:rank_suffix]}"
  end

  def build_score_text(score)
    "#{format('%.1f', score || SCORE_DEFAULT)}#{TEXT_CONFIG[:score_suffix]}"
  end

  def build_post_draw_items
    rank_text = build_rank_text(calculate_rank_with_fallback)
    score_text = build_score_text(@post.average_score)

    [
      text_item(:nickname, sanitize_post_text(@post.nickname), TEXT_COLORS[:primary], FONT_BOLD_PATH),
      text_item(:body, sanitize_post_text(@post.body), TEXT_COLORS[:primary], FONT_PATH),
      text_item(:score, score_text, TEXT_COLORS[:score], FONT_BOLD_PATH),
      text_item(:rank, rank_text, TEXT_COLORS[:secondary], FONT_PATH)
    ]
  end

  def sanitize_post_text(text)
    sanitize_text(text)
  end

  def text_item(layout_key, text, color, font_path)
    {
      text: text,
      size: FONT_SIZES[layout_key],
      color: color,
      x: LAYOUT[layout_key][:x],
      y: LAYOUT[layout_key][:y],
      font: font_path
    }
  end

  def resource_label(path)
    return 'Base image' if path == BASE_IMAGE_PATH

    'Font file'
  end

  # ログ出力メソッド
  def log_success
    Rails.logger.info("[OgpGeneratorService] OGP画像生成成功: post_id=#{@post.id}")
  end

  def log_error(message)
    Rails.logger.error("[OgpGeneratorService] #{message}")
  end

  def log_warn(message)
    Rails.logger.warn("[OgpGeneratorService] #{message}")
  end

  # rubocop:disable Metrics/ParameterLists, Naming/MethodParameterName
  def draw_text(image, text, size, color, x, y, font_path)
    image.combine_options do |config|
      config.font font_path.to_s
      config.fill color
      config.pointsize size
      config.gravity 'northwest'
      config.draw "text #{x},#{y} '#{escape_single_quotes(text)}'"
    end
  end
  # rubocop:enable Metrics/ParameterLists, Naming/MethodParameterName

  # 制御文字を削除（改行・タブは保持）
  def sanitize_text(text)
    return '' if text.nil?

    # 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F のみ削除（改行0x0A、タブ0x09は保持）
    # ImageMagick描画前にサニタイズし、コマンド注入とレイアウト崩れの両方を防ぐ。
    text.gsub(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/, '').gsub(/[\r\n]+/, ' ')
  end

  def escape_single_quotes(text)
    # まずバックスラッシュをエスケープし、その後シングルクォートをエスケープ
    # ImageMagick MVGパーサーではバックスラッシュも特殊文字として扱われるため
    text.gsub('\\') { '\\\\' }.gsub("'") { "\\'" }
  end
end
# rubocop:enable Metrics/ClassLength
