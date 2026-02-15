# frozen_string_literal: true

# OGP画像生成サービス
class OgpGeneratorService
  IMAGE_WIDTH = 1200
  IMAGE_HEIGHT = 630
  IMAGE_FORMAT = 'PNG'

  JUDGE_COLORS = {
    'hiroyuki' => '#4A90E2',
    'dewi' => '#F5A623',
    'nakao' => '#D0021B'
  }.freeze

  BASE_IMAGE_PATH = Rails.root.join('app/assets/images/base_ogp.png')
  FONT_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Regular.otf')
  FONT_BOLD_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Bold.otf')

  JUDGE_ICON_PATHS = {
    'hiroyuki' => Rails.root.join('app/assets/images/judge_hiroyuki.png'),
    'dewi' => Rails.root.join('app/assets/images/judge_dewi.png'),
    'nakao' => Rails.root.join('app/assets/images/judge_nakao.png')
  }.freeze

  # 画像レイアウト定数
  LAYOUT = {
    # テキスト描画位置
    nickname: { x: 100, y: 100 },
    body: { x: 100, y: 160 },
    score: { x: 900, y: 100 },
    rank: { x: 900, y: 180 },

    # 審査員情報描画位置
    judges_start_y: 250,
    judges_x_offset: 50,
    judges_y_step: 100,

    # 審査員アイコン位置
    icon: { width: 50, height: 50, x: 50 },

    # 審査員テキスト位置
    judge_score_y_offset: 10,
    judge_comment_y_offset: 40,
    judge_text_x_offset: 120
  }.freeze

  # フォントサイズ定数
  FONT_SIZES = {
    nickname: 48,
    body: 36,
    score: 72,
    rank: 36,
    judge_score: 24,
    judge_comment: 18
  }.freeze

  # テキスト色定数
  TEXT_COLORS = {
    primary: '#333333',
    score: '#FF6B6B',
    secondary: '#666666'
  }.freeze

  # テキスト定数
  TEXT_CONFIG = {
    # 最大文字数
    max_comment_length: 20,
    comment_ellipsis: '...',

    # テキストフォーマット
    rank_prefix: '第',
    rank_suffix: '位',
    out_of_rank: '圏外',
    score_suffix: '点'
  }.freeze

  def initialize(post_id)
    @post = Post.find(post_id)
    @judgments = @post.judgments.to_a
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
    image = draw_judgments(image)
    return nil if image.nil?

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

  # 投稿情報（ニックネーム・本文・スコア・ランキング）を描画する
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

  # 審査員情報（アイコン・スコア・コメント）を描画する
  # rubocop:disable Metrics/MethodLength
  def draw_judgments(image)
    # 審査員情報描画
    y_offset = LAYOUT[:judges_start_y]
    @judgments.each do |judgment|
      next unless judgment.succeeded
      next unless JUDGE_COLORS.key?(judgment.persona)

      # アイコン存在チェック（Pathnameオブジェクトを文字列に変換してチェック）
      icon_path = JUDGE_ICON_PATHS[judgment.persona]
      unless file_exists?(icon_path)
        log_error('Judge icon not found')
        return nil
      end

      # アイコン合成（位置指定付き）
      icon = MiniMagick::Image.open(icon_path)
      image = image.composite(icon) do |c|
        c.geometry "#{LAYOUT[:icon][:width]}x#{LAYOUT[:icon][:height]}+#{LAYOUT[:icon][:x]}+#{y_offset}"
        c.compose 'over'
      end

      # スコア描画
      color = JUDGE_COLORS[judgment.persona]
      draw_text(image, "#{judgment.total_score}#{TEXT_CONFIG[:score_suffix]}", FONT_SIZES[:judge_score], color,
                LAYOUT[:judge_text_x_offset], y_offset + LAYOUT[:judge_score_y_offset], FONT_PATH)

      # コメント描画（先頭20文字）
      comment = sanitize_text(judgment.comment)
      comment_text = if comment.length > TEXT_CONFIG[:max_comment_length]
                       "#{comment[0,
                                  TEXT_CONFIG[:max_comment_length]]}#{TEXT_CONFIG[:comment_ellipsis]}"
                     else
                       comment
                     end
      draw_text(image, comment_text, FONT_SIZES[:judge_comment], TEXT_COLORS[:secondary], LAYOUT[:judge_text_x_offset],
                y_offset + LAYOUT[:judge_comment_y_offset], FONT_PATH)

      y_offset += LAYOUT[:judges_y_step]
    end

    image
  rescue MiniMagick::Error => e
    log_error("Failed to draw judgments: #{e.message}")
    nil
  end
  # rubocop:enable Metrics/MethodLength

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
