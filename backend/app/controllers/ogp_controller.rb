# frozen_string_literal: true

# OGP画像を生成・返却するコントローラー
class OgpController < ApplicationController
  # rubocop:disable Metrics/MethodLength
  def show
    post = Post.where(id: params[:id]).first
    return render_not_found if post.nil? || post.status != Post::STATUS_SCORED

    image_data = OgpGeneratorService.call(post.id)

    if image_data
      response.headers['Cache-Control'] = 'max-age=604800, public'
      send_data image_data, type: 'image/png', disposition: 'inline'
    else
      render_not_found
    end
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    render_not_found
  end
  # rubocop:enable Metrics/MethodLength

  private

  def render_not_found
    render json: { error: '投稿が見つかりません', code: 'NOT_FOUND' }, status: :not_found
  end
end
