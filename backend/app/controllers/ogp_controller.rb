# frozen_string_literal: true

# OGP画像を生成・返却するコントローラー
#
# 投稿IDを受け取り、OGP画像を生成して返す。
# 生成に失敗した場合はデフォルト画像にフォールバックする。
class OgpController < ApplicationController
  # Cache-Control設定
  # OGP画像: 7日間（604800秒）- 投稿内容は変わらないため長期キャッシュ
  CACHE_CONTROL_OGP_IMAGE = 'max-age=604800, public'
  # デフォルト画像: 1時間（3600秒）- 問題解決後の再取得を促すため短期キャッシュ
  CACHE_CONTROL_DEFAULT_IMAGE = 'max-age=3600, public'
  LAMBY_BASE64_HEADER = '1'

  # デフォルトOGP画像のパス
  DEFAULT_OGP_IMAGE_PATH = Rails.root.join('app/assets/images/default_ogp.png')

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def show
    post = Post.where(id: params[:id]).first
    # 投稿が見つからない/未審査の場合もデフォルト画像を返す
    # 404を返すとCloudFrontのcustom_error_responseでindex.htmlが返るため
    return send_default_ogp_image if post.nil? || post.status != Post::STATUS_SCORED

    image_data = OgpGeneratorService.call(post.id)

    if image_data
      response.headers['Cache-Control'] = CACHE_CONTROL_OGP_IMAGE
      response.headers['X-Lamby-Base64'] = LAMBY_BASE64_HEADER
      send_data image_data, type: 'image/png', disposition: 'inline'
    else
      # OGP生成がnilを返した場合のフォールバック
      send_default_ogp_image
    end
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey => e
    Rails.logger.warn("[OgpController] Dynamoid error for post #{params[:id]}: #{e.message}")
    send_default_ogp_image
  rescue MiniMagick::Error => e
    # ImageMagick関連エラー時のフォールバック
    Rails.logger.warn("[OgpController] MiniMagick error for post #{params[:id]}: #{e.message}")
    send_default_ogp_image
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  private

  def render_not_found
    render json: { error: '投稿が見つかりません', code: 'NOT_FOUND' }, status: :not_found
  end

  def render_internal_error
    render json: { error: '内部エラーが発生しました', code: 'INTERNAL_ERROR' }, status: :internal_server_error
  end

  # デフォルトOGP画像を返す（フォールバック処理）
  #
  # OGP生成に失敗した場合、デフォルト画像を返すことで
  # ユーザー体験を損なわないようにする。
  # デフォルト画像が存在しない場合は500エラーを返す。
  def send_default_ogp_image
    unless File.exist?(DEFAULT_OGP_IMAGE_PATH.to_s)
      Rails.logger.error("[OgpController] Default OGP image not found at #{DEFAULT_OGP_IMAGE_PATH}")
      return render_internal_error
    end

    Rails.logger.warn("[OgpController] Serving default OGP image for post #{params[:id]}")
    response.headers['Cache-Control'] = CACHE_CONTROL_DEFAULT_IMAGE
    response.headers['X-Lamby-Base64'] = LAMBY_BASE64_HEADER
    send_file DEFAULT_OGP_IMAGE_PATH, type: 'image/png', disposition: 'inline'
  end
end
