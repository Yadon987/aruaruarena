# frozen_string_literal: true

# OGP画像生成サービス
# rubocop:disable Metrics/ClassLength
class OgpGeneratorService
  IMAGE_WIDTH = 1200
  IMAGE_HEIGHT = 630
  IMAGE_FORMAT = 'PNG'
  SCORE_DEFAULT = 0
  BODY_MAX_LINES = 4
  BODY_LINE_SPACING = 14

  BASE_IMAGE_PATH = Rails.root.join('app/assets/images/base_ogp.png')
  # 実行環境依存のシステムフォントではなく、同梱フォントを使って描画失敗を防ぐ。
  FONT_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Regular.otf')
  FONT_BOLD_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Bold.otf')
  NUMBER_FONT_PATH = Rails.root.join('app/assets/fonts/NotoSansJP-Bold.otf')
  REQUIRED_FILES = [BASE_IMAGE_PATH, FONT_PATH, FONT_BOLD_PATH, NUMBER_FONT_PATH].freeze

  # 画像レイアウト定数
  LAYOUT = {
    panel: { x1: 58, y1: 54, x2: 548, y2: 576, radius: 30 },
    rank_area: { x1: 630, x2: 1110 },
    title_plate: { x1: 142, y1: 74, x2: 474, y2: 128, radius: 18 },
    footer: { x: 142, y: 74, max_width: 332 },
    nickname: { x: 96, y: 142, max_width: 380 },
    body: { x: 92, y: 198, max_width: 450 },
    rank_number: { x: 92, y: 368, max_width: 250 },
    rank_pending: { x: 92, y: 382, max_width: 480 },
    rank_suffix: { x: 92, y: 404, max_width: 90 },
    score_number: { x: 92, y: 440, max_width: 360 },
    score_suffix: { x: 92, y: 470, max_width: 90 }
  }.freeze

  # フォントサイズ定数
  FONT_SIZES = {
    body: 38,
    nickname: 30,
    rank_number: 132,
    rank_pending: 64,
    rank_suffix: 64,
    score_number: 112,
    score_suffix: 52,
    footer: 40
  }.freeze

  MIN_FONT_SIZES = {
    body: 34,
    nickname: 26,
    rank_number: 112,
    rank_pending: 48,
    rank_suffix: 52,
    score_number: 96,
    score_suffix: 44,
    footer: 34
  }.freeze

  # テキスト色定数
  TEXT_COLORS = {
    body: '#FFFDF7',
    nickname: '#F4E4C1',
    rank: '#8DFBFF',
    score: '#FFD84A',
    footer: '#FFF4BF',
    stroke_dark: 'rgba(16, 8, 38, 0.82)',
    shadow: 'rgba(10, 4, 24, 0.28)',
    footer_glow: 'rgba(255, 223, 120, 0.55)',
    title_plate_fill: 'rgba(255, 196, 64, 0.28)',
    title_plate_stroke: 'rgba(255, 230, 150, 0.78)',
    panel_fill: 'rgba(20, 8, 56, 0.78)',
    panel_stroke: 'rgba(255, 255, 255, 0.18)'
  }.freeze

  # テキスト定数
  TEXT_CONFIG = {
    rank_suffix: '位',
    score_suffix: '点',
    nickname_prefix: '投稿者',
    footer_text: 'あるあるアリーナ'
  }.freeze

  def initialize(post_or_id)
    @post = post_or_id.is_a?(Post) ? post_or_id : Post.find(post_or_id)
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[OgpGeneratorService] Post not found: #{post_or_id}")
    @post = nil
  end

  # rubocop:disable Metrics/MethodLength
  def execute
    return nil unless valid_post?
    return nil unless ensure_resources_exist?

    image = create_base_image
    return nil if image.nil?

    draw_post_info(image)

    # PNG圧縮を適用してファイルサイズを削減
    compress_png(image)

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
    def call(post_or_id)
      new(post_or_id).execute
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
    draw_overlay_panel(image)
    draw_title_plate(image)
    build_post_draw_items.each do |item|
      draw_text(image, item)
    end
  end

  # ファイル存在確認で例外が起きても生成フロー全体は落とさない
  def file_exists?(path)
    File.exist?(path.to_s)
  rescue StandardError => e
    Rails.logger.warn("[OgpGeneratorService] File.exist? error: #{e.message}")
    false
  end

  def build_score_text(score)
    "#{format('%.1f', score || SCORE_DEFAULT)}#{TEXT_CONFIG[:score_suffix]}"
  end

  def build_rank_text(rank)
    return 'ランク集計中' if rank.nil?

    "#{rank}#{TEXT_CONFIG[:rank_suffix]}"
  end

  def build_post_draw_items
    nickname_text = "#{TEXT_CONFIG[:nickname_prefix]}  #{sanitize_post_text(@post.nickname)}"

    [
      *build_body_items,
      build_footer_item,
      build_nickname_item(nickname_text),
      *build_rank_items,
      *build_score_items
    ]
  end

  def build_body_items
    font_size = body_font_size
    lines = build_body_lines(font_size: font_size)

    lines.map.with_index { |line, index| build_body_item(line, index, font_size) }
  end

  def build_footer_item
    left_text_item(:footer, footer_item_options)
  end

  def build_nickname_item(nickname_text)
    left_text_item(
      :nickname,
      {
        text: nickname_text,
        color: TEXT_COLORS[:nickname],
        font_path: FONT_BOLD_PATH,
        stroke_width: 1
      }
    )
  end

  def build_rank_items
    rank = safe_rank
    return [build_pending_rank_item] if rank.nil?

    centered_pair_items(
      :rank_number,
      :rank_suffix,
      build_rank_text(rank).chomp(TEXT_CONFIG[:rank_suffix]),
      TEXT_CONFIG[:rank_suffix],
      style: rank_pair_style
    )
  end

  def build_pending_rank_item
    left_text_item(:rank_pending, pending_rank_item_options)
  end

  def build_score_items
    centered_pair_items(
      :score_number,
      :score_suffix,
      build_score_text(@post.average_score).chomp(TEXT_CONFIG[:score_suffix]),
      TEXT_CONFIG[:score_suffix],
      style: score_pair_style
    )
  end

  def rank_pair_style
    {
      color: TEXT_COLORS[:rank],
      number_font_path: NUMBER_FONT_PATH,
      suffix_font_path: FONT_BOLD_PATH,
      gap: 8,
      number_stroke_width: 6,
      suffix_stroke_width: 3,
      area: :rank_area
    }
  end

  def score_pair_style
    {
      color: TEXT_COLORS[:score],
      number_font_path: NUMBER_FONT_PATH,
      suffix_font_path: FONT_BOLD_PATH,
      gap: 10,
      number_stroke_width: 5,
      suffix_stroke_width: 2
    }
  end

  def sanitize_post_text(text)
    sanitize_text(text)
  end

  def build_body_item(line, index, font_size)
    multiline_text_item(:body, body_item_options(line, index, font_size))
  end

  def footer_glow_options
    { color: TEXT_COLORS[:footer_glow], layers: [{ x: 0, y: 0 }, { x: 0, y: 2 }] }
  end

  def footer_item_options
    {
      text: TEXT_CONFIG[:footer_text],
      color: TEXT_COLORS[:footer],
      font_path: FONT_BOLD_PATH,
      stroke_width: 2,
      shadow: false,
      glow: footer_glow_options,
      center_in: :title_plate
    }
  end

  def pending_rank_item_options
    {
      text: build_rank_text(nil),
      color: TEXT_COLORS[:rank],
      font_path: FONT_BOLD_PATH,
      stroke_width: 3,
      shadow: false,
      center_in: :rank_area
    }
  end

  def body_item_options(line, index, font_size)
    {
      text: line,
      color: TEXT_COLORS[:body],
      font_path: FONT_BOLD_PATH,
      y_position: body_item_y(index, font_size),
      font_size: font_size,
      stroke_width: 1,
      shadow: false
    }
  end

  def body_item_y(index, font_size)
    LAYOUT[:body][:y] + ((font_size + BODY_LINE_SPACING) * index)
  end

  def left_text_item(layout_key, item_options)
    text = item_options[:text]
    item_options[:x_position] = resolve_x_position(layout_key, text, item_options[:center_in])
    item_options[:y_position] = LAYOUT[layout_key][:y]
    item_options[:font_size] = fitted_font_size(layout_key, text)

    build_text_item(text_item_attributes(layout_key, item_options))
  end

  def multiline_text_item(layout_key, item_options)
    text = item_options[:text]
    item_options[:x_position] = LAYOUT[layout_key][:x]
    item_options[:font_size] ||= fitted_font_size(layout_key, text)

    build_text_item(text_item_attributes(layout_key, item_options))
  end

  def text_item_attributes(layout_key, item_options)
    base_text_item_attributes(layout_key, item_options).merge(
      text_item_effect_attributes(item_options)
    )
  end

  def base_text_item_attributes(layout_key, item_options)
    {
      text: item_options[:text],
      size: item_options[:font_size],
      color: item_options[:color],
      x: item_options[:x_position],
      y: item_options[:y_position],
      font: item_options[:font_path],
      layout_key: layout_key
    }
  end

  def text_item_effect_attributes(item_options)
    stroke_width = item_options.fetch(:stroke_width, 0)

    {
      stroke_color: TEXT_COLORS[:stroke_dark],
      stroke_width: stroke_width,
      shadow: resolve_shadow(item_options.fetch(:shadow, true), stroke_width),
      glow: item_options[:glow]
    }
  end

  def build_text_item(attributes)
    attributes
  end

  def resolve_x_position(layout_key, text, center_in)
    return LAYOUT[layout_key][:x] unless center_in

    centered_text_x(text, fitted_font_size(layout_key, text), center_in)
  end

  def resolve_shadow(enabled, stroke_width)
    enabled ? shadow_options(stroke_width) : nil
  end

  def centered_pair_items(number_layout_key, suffix_layout_key, number_text, suffix_text, style:)
    number_item = build_pair_item(number_layout_key, number_text, style, :number)
    suffix_item = build_pair_item(suffix_layout_key, suffix_text, style, :suffix)

    place_pair_items(number_item, suffix_item, style)
  end

  def build_pair_item(layout_key, text, style, part)
    left_text_item(
      layout_key,
      {
        text: text,
        color: style[:color],
        font_path: style[:"#{part}_font_path"],
        stroke_width: style[:"#{part}_stroke_width"]
      }
    )
  end

  def place_pair_items(number_item, suffix_item, style)
    start_x = centered_x_for_area(pair_total_width(number_item, suffix_item, style), style[:area] || :panel)
    number_width = estimate_text_width(number_item[:text], number_item[:size])

    number_item[:x] = start_x
    suffix_item[:x] = start_x + number_width + style[:gap]
    [number_item, suffix_item]
  end

  def pair_total_width(number_item, suffix_item, style)
    estimate_text_width(number_item[:text], number_item[:size]) +
      style[:gap] +
      estimate_text_width(suffix_item[:text], suffix_item[:size])
  end

  def centered_x_for_area(total_width, area_key)
    area = LAYOUT[area_key]
    x1 = area[:x1]
    x2 = area[:x2]
    x1 + (((x2 - x1) - total_width) / 2.0).floor
  end

  def centered_text_x(text, font_size, area_key)
    area = LAYOUT[area_key]
    text_width = estimate_text_width(text, font_size)
    area[:x1] + (((area[:x2] - area[:x1]) - text_width) / 2.0).floor
  end

  def build_body_lines(font_size: body_font_size)
    wrapped_lines(
      sanitized_body_text,
      max_width: LAYOUT[:body][:max_width],
      font_size: font_size,
      max_lines: BODY_MAX_LINES
    )
  end

  def sanitized_body_text
    sanitize_post_text("「#{@post.body}」")
  end

  def wrapped_lines(text, max_width:, font_size:, max_lines:)
    lines = wrap_lines(text, max_width: max_width, font_size: font_size)

    return lines if lines.length <= max_lines

    truncated = lines.first(max_lines)
    truncated[-1] = fit_text_with_ellipsis(truncated[-1], max_width, font_size)
    truncated
  end

  def fit_text_with_ellipsis(text, max_width, font_size)
    base_text = text.to_s.dup
    return '...' if base_text.empty?

    loop do
      candidate = "#{base_text}..."
      return candidate if estimate_text_width(candidate, font_size) <= max_width

      base_text = base_text[0...-1]
      return '...' if base_text.empty?
    end
  end

  def body_font_size
    font_size = FONT_SIZES[:body]
    min_size = MIN_FONT_SIZES[:body]

    font_size -= 2 while font_size > min_size && body_line_count(font_size) > BODY_MAX_LINES

    font_size
  end

  def body_line_count(font_size)
    wrap_lines(
      sanitized_body_text,
      max_width: LAYOUT[:body][:max_width],
      font_size: font_size
    ).length
  end

  def fitted_font_size(layout_key, text)
    layout = LAYOUT[layout_key]
    font_size = FONT_SIZES[layout_key]
    min_size = MIN_FONT_SIZES[layout_key]

    font_size -= 2 while font_size > min_size && estimate_text_width(text, font_size) > layout[:max_width]

    font_size
  end

  def wrap_lines(text, max_width:, font_size:)
    return [''] if text.blank?

    lines = []
    current_line = +''

    text.each_char do |char|
      current_line = append_char_or_wrap(lines, current_line, char, max_width, font_size)
    end
    lines << current_line unless current_line.empty?

    lines
  end

  def append_char_or_wrap(lines, current_line, char, max_width, font_size)
    candidate = "#{current_line}#{char}"
    return candidate if current_line.empty? || estimate_text_width(candidate, font_size) <= max_width

    lines << current_line
    char
  end

  def shadow_options(stroke_width)
    {
      color: TEXT_COLORS[:shadow],
      x: 0,
      y: [stroke_width + 5, 6].max
    }
  end

  def estimate_text_width(text, font_size)
    text.each_char.sum { |char| character_width_ratio(char) * font_size }.ceil
  end

  def character_width_ratio(char)
    return 0.72 if char.match?(/[A-Z0-9]/)
    return 0.62 if char.match?(/[a-z]/)
    return 1.0 if char.match?(/[぀-ヿ一-龠々ー]/)
    return 0.38 if char.match?(/[[:space:]]/)

    0.82
  end

  def safe_rank
    @post.calculate_rank
  rescue StandardError => e
    Rails.logger.warn("[OgpGeneratorService] Rank calculation failed: #{e.class} - #{e.message}")
    nil
  end

  def resource_label(path)
    return 'Base image' if path == BASE_IMAGE_PATH

    'Font file'
  end

  # ログ出力メソッド
  def log_success
    LogOgpGenerationEventService.call(event: 'ogp_generation_succeeded', post: @post)
    Rails.logger.info("[OgpGeneratorService] OGP画像生成成功: post_id=#{@post.id}")
  end

  def log_error(message)
    Rails.logger.error("[OgpGeneratorService] #{message}")
  end

  def draw_overlay_panel(image)
    draw_roundrectangle(image, :panel, fill: TEXT_COLORS[:panel_fill], stroke: TEXT_COLORS[:panel_stroke])
  end

  def draw_title_plate(image)
    draw_roundrectangle(
      image,
      :title_plate,
      fill: TEXT_COLORS[:title_plate_fill],
      stroke: TEXT_COLORS[:title_plate_stroke]
    )
  end

  def draw_text(image, item)
    draw_glow(image, item) if item[:glow]
    draw_shadow(image, item) if item[:shadow]
    apply_text_layer(image, item, fill: item[:color], position: text_position(item), stroke: item[:stroke_color])
  end

  def draw_shadow(image, item)
    apply_text_layer(
      image,
      item,
      fill: item[:shadow][:color],
      position: shadow_position(item),
      stroke: 'transparent'
    )
  end

  def draw_glow(image, item)
    item[:glow][:layers].each do |layer|
      apply_text_layer(
        image,
        item,
        fill: item[:glow][:color],
        position: layer_position(item, layer),
        stroke: 'transparent'
      )
    end
  end

  def draw_roundrectangle(image, layout_key, fill:, stroke:)
    image.combine_options do |config|
      config.fill fill
      config.stroke stroke
      config.strokewidth 2
      config.draw roundrectangle_command(LAYOUT[layout_key])
    end
  end

  def roundrectangle_command(layout)
    "roundrectangle #{layout[:x1]},#{layout[:y1]} " \
      "#{layout[:x2]},#{layout[:y2]} #{layout[:radius]},#{layout[:radius]}"
  end

  def text_position(item)
    { x: item[:x], y: item[:y], stroke_width: item[:stroke_width] }
  end

  def shadow_position(item)
    {
      x: item[:x] + item[:shadow][:x],
      y: item[:y] + item[:shadow][:y]
    }
  end

  def layer_position(item, layer)
    { x: item[:x] + layer[:x], y: item[:y] + layer[:y] }
  end

  def apply_text_layer(image, item, fill:, position:, stroke:)
    image.combine_options do |config|
      config.font item[:font].to_s
      config.encoding 'UTF-8'
      config.fill fill
      config.stroke stroke if stroke
      apply_stroke_width(config, position[:stroke_width])
      config.pointsize item[:size]
      config.gravity 'northwest'
      config.draw text_draw_command(item[:text], position)
    end
  end

  def apply_stroke_width(config, stroke_width)
    config.strokewidth stroke_width if stroke_width.to_i.positive?
  end

  def text_draw_command(text, position)
    "text #{position[:x]},#{position[:y]} '#{escape_single_quotes(text)}'"
  end

  # 制御文字を削除（改行・タブは保持）
  def sanitize_text(text)
    return '' if text.nil?

    sanitized = text.gsub(/\p{Emoji_Presentation}/, '')
    # 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F のみ削除（改行0x0A、タブ0x09は保持）
    # ImageMagick描画前にサニタイズし、コマンド注入とレイアウト崩れの両方を防ぐ。
    sanitized.gsub(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/, '').gsub(/[\r\n]+/, ' ')
  end

  def escape_single_quotes(text)
    # まずバックスラッシュをエスケープし、その後シングルクォートをエスケープ
    # ImageMagick MVGパーサーではバックスラッシュも特殊文字として扱われるため
    text.gsub('\\') { '\\\\' }.gsub("'") { "\\'" }.gsub('`') { '\\`' }
  end

  # PNG画像の圧縮を行う
  # ファイルサイズを削減して、SNSでの読み込み速度を向上させる
  def compress_png(image)
    image.combine_options do |config|
      config.quality 85
      config.define 'png:compression-level=9'
      config.define 'png:compression-strategy=1'
    end
  end
end
# rubocop:enable Metrics/ClassLength
