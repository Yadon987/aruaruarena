# frozen_string_literal: true

# OGP画像を生成・返却するコントローラー
class OgpController < ApplicationController
  DEFAULT_OGP_IMAGE_PATH = Rails.root.join('app/assets/images/default_ogp.png')

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def show
    post = Post.where(id: params[:id]).first
    return render_not_found if post.nil? || post.status != Post::STATUS_SCORED

    image_data = OgpGeneratorService.call(post.id)

    if image_data
      response.headers['Cache-Control'] = 'max-age=604800, public'
      send_data image_data, type: 'image/png', disposition: 'inline'
    else
      send_default_ogp_image
    end
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    render_not_found
  rescue MiniMagick::Error => e
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

  def send_default_ogp_image
    unless File.exist?(DEFAULT_OGP_IMAGE_PATH.to_s)
      Rails.logger.error("[OgpController] Default OGP image not found at #{DEFAULT_OGP_IMAGE_PATH}")
      return render_internal_error
    end

    Rails.logger.warn("[OgpController] Serving default OGP image for post #{params[:id]}")
    response.headers['Cache-Control'] = 'max-age=3600, public'
    send_file DEFAULT_OGP_IMAGE_PATH, type: 'image/png', disposition: 'inline'
  end
end
