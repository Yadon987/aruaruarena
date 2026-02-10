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
      post = Post.new(post_params.merge(id: SecureRandom.uuid))

      if post.save
        start_judgment_async(post)
        render json: { id: post.id, status: post.status }, status: :created
      else
        render_validation_error(post)
      end
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

    # バリデーションエラーのレスポンスを返す
    # @param post [Post] バリデーション失敗した投稿オブジェクト
    # @return [void] JSONレスポンスをレンダリング
    def render_validation_error(post)
      render json: {
        error: build_error_message(post),
        code: ERROR_CODE_VALIDATION
      }, status: :unprocessable_content
    end

    # 不正なリクエストのエラーレスポンスを返す
    # @return [void] JSONレスポンスをレンダリング
    def render_bad_request
      render json: {
        error: ERROR_MESSAGE_INVALID_REQUEST,
        code: ERROR_CODE_BAD_REQUEST
      }, status: :bad_request
    end

    # 非同期で審査を開始する
    #
    # Thread.newでJudgePostServiceを非同期実行し、レスポンスには影響しないようにする
    # Thread内で例外が発生した場合はログに出力のみ行う
    #
    # @param post [Post] 投稿オブジェクト
    # @return [Thread] 生成されたThreadオブジェクト（テスト用）
    def start_judgment_async(post)
      Thread.new do
        JudgePostService.call(post.id)
      rescue StandardError => e
        handle_judgment_error(e, post.id)
      end
    end

    # Thread内の例外を処理する
    #
    # Thread内で例外が発生してもレスポンスには影響しないため、
    # ERRORレベルでログを出力して監視可能にする
    #
    # @param error [Exception] 発生した例外
    # @param _post_id [String] 投稿ID（将来のログ出力用に確保）
    def handle_judgment_error(error, _post_id)
      Rails.logger.error("[JudgePostService] Failed: #{error.class} - #{error.message}")
      Rails.logger.error(error.backtrace.join("\n")) if Rails.env.development?
    end
  end
end
