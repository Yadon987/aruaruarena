# frozen_string_literal: true

# OGP画像生成サービス
# rubocop:disable Metrics/ClassLength
class OgpGeneratorService
  IMAGE_WIDTH = 1200
  IMAGE_HEIGHT = 630
  IMAGE_FORMAT = 'PNG'

  BASE_IMAGE_PATH = Rails.root.join('app/assets/images/base_ogp.png')
  FONT_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Regular.otf')
  FONT_BOLD_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Bold.otf')

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
    return false if @post.nil?
    return false if @post.status != Post::STATUS_SCORED

    true
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
  # rubocop:disable Metrics/MethodLength
  def ensure_resources_exist?
    unless file_exists?(BASE_IMAGE_PATH)
      log_error("Base image not found: #{BASE_IMAGE_PATH}")
      return false
    end

    unless file_exists?(FONT_PATH)
      log_error("Font file not found: #{FONT_PATH}")
      return false
    end

    unless file_exists?(FONT_BOLD_PATH)
      log_error("Font file not found: #{FONT_BOLD_PATH}")
      return false
    end

    true
  end
  # rubocop:enable Metrics/MethodLength

  # 投稿情報（ニックネーム・本文・スコア・ランキング）を描画する
  # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
  def draw_post_info(image)
    # ランキング取得（例外ハンドリング付き）
    rank = calculate_rank_with_fallback
    rank_text = rank ? "#{TEXT_CONFIG[:rank_prefix]}#{rank}#{TEXT_CONFIG[:rank_suffix]}" : TEXT_CONFIG[:out_of_rank]

    # スコア表示（nilなら0点、小数第1位まで表示）
    score = @post.average_score || 0
    score_text = "#{format('%.1f', score)}#{TEXT_CONFIG[:score_suffix]}"

    # 文字列サニタイズ
    nickname = sanitize_text(@post.nickname)
    body = sanitize_text(@post.body)

    # テキスト描画
    draw_text(image, nickname, FONT_SIZES[:nickname], TEXT_COLORS[:primary], LAYOUT[:nickname][:x],
              LAYOUT[:nickname][:y], FONT_BOLD_PATH)
    draw_text(image, body, FONT_SIZES[:body], TEXT_COLORS[:primary], LAYOUT[:body][:x], LAYOUT[:body][:y], FONT_PATH)
    draw_text(image, score_text, FONT_SIZES[:score], TEXT_COLORS[:score], LAYOUT[:score][:x], LAYOUT[:score][:y],
              FONT_BOLD_PATH)
    draw_text(image, rank_text, FONT_SIZES[:rank], TEXT_COLORS[:secondary], LAYOUT[:rank][:x], LAYOUT[:rank][:y],
              FONT_PATH)
  end
  # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

  # アイコンが有効か確認する（存在チェック）
  def file_exists?(path)
    File.exist?(path.to_s)
  rescue StandardError => e
    Rails.logger.warn("[OgpGeneratorService] File.exist? error: #{e.message}")
    false
  end

  # ランキング計算（例外ハンドリング付き）
  def calculate_rank_with_fallback
    @post.calculate_rank
  rescue StandardError => e
    log_warn("Failed to calculate rank: #{e.message}")
    nil
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
    # さらに改行文字を半角スペースに置換（ImageMagick描画崩れ防止）
    text.gsub(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/, '').gsub(/[\r\n]+/, ' ')
  end

  def escape_single_quotes(text)
    # まずバックスラッシュをエスケープし、その後シングルクォートをエスケープ
    # ImageMagick MVGパーサーではバックスラッシュも特殊文字として扱われるため
    text.gsub('\\', '\\\\').gsub("'", "\\'")
  end
end
# rubocop:enable Metrics/ClassLength
