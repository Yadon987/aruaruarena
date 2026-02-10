# frozen_string_literal: true

module Api
  class PostsController < ApplicationController
    def create
      post = Post.new(post_params)
      post.id = SecureRandom.uuid

      unless post.valid?
        # 優先順位を明示的に制御: nickname → body → その他
        error_message = post.errors[:nickname].first || post.errors[:body].first || post.errors.full_messages.first
        # フィールド名をエラーメッセージの前に追加
        if post.errors[:nickname].first
          error_message = "ニックネーム#{error_message}"
        elsif post.errors[:body].first
          error_message = "本文#{error_message}"
        end
        render json: {
          error: error_message,
          code: 'VALIDATION_ERROR'
        }, status: :unprocessable_content
        return
      end

      post.save!
      render json: { id: post.id, status: post.status }, status: :created
    rescue ActionController::ParameterMissing
      render json: { error: 'リクエスト形式が正しくありません', code: 'BAD_REQUEST' }, status: :bad_request
    rescue ActionDispatch::Http::Parameters::ParseError
      # 不正なJSON形式
      render json: { error: 'リクエスト形式が正しくありません', code: 'BAD_REQUEST' }, status: :bad_request
    end

    private

    def post_params
      params.require(:post).permit(:nickname, :body)
    end
  end
end
