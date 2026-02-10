# frozen_string_literal: true

module Api
  class PostsController < ApplicationController
    # エラーコード定数
    ERROR_CODE_VALIDATION = 'VALIDATION_ERROR'
    ERROR_CODE_BAD_REQUEST = 'BAD_REQUEST'

    # エラーメッセージ定数
    ERROR_MESSAGE_INVALID_REQUEST = 'リクエスト形式が正しくありません'
    FIELD_LABEL_NICKNAME = 'ニックネーム'
    FIELD_LABEL_BODY = '本文'

    def create
      post = Post.new(post_params)
      post.id = SecureRandom.uuid

      unless post.valid?
        render json: {
          error: build_error_message(post),
          code: ERROR_CODE_VALIDATION
        }, status: :unprocessable_content
        return
      end

      post.save!
      render json: { id: post.id, status: post.status }, status: :created
    rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
      render_bad_request
    end

    private

    def post_params
      params.expect(post: %i[nickname body])
    end

    # エラーメッセージにフィールド名を追加する
    # @param post [Post] バリデーション失敗した投稿オブジェクト
    # @return [String] フィールド名付きエラーメッセージ
    def build_error_message(post)
      error_message = post.errors[:nickname].first ||
                      post.errors[:body].first ||
                      post.errors.full_messages.first

      if post.errors[:nickname].first
        "#{FIELD_LABEL_NICKNAME}#{error_message}"
      elsif post.errors[:body].first
        "#{FIELD_LABEL_BODY}#{error_message}"
      else
        error_message
      end
    end

    # 不正なリクエストのエラーレスポンスを返す
    # @return [void] JSONレスポンスをレンダリング
    def render_bad_request
      render json: {
        error: ERROR_MESSAGE_INVALID_REQUEST,
        code: ERROR_CODE_BAD_REQUEST
      }, status: :bad_request
    end
  end
end
