# frozen_string_literal: true

module Api
  class PostsController < ApplicationController
    # エラーコード定数
    ERROR_CODE_VALIDATION = 'VALIDATION_ERROR'
    ERROR_CODE_BAD_REQUEST = 'BAD_REQUEST'
    ERROR_CODE_NOT_FOUND = 'NOT_FOUND'
    ERROR_CODE_RATE_LIMITED = 'RATE_LIMITED'

    # エラーメッセージ定数
    ERROR_MESSAGE_NOT_FOUND = '投稿が見つかりません'
    ERROR_MESSAGE_RATE_LIMITED = '投稿頻度を制限中'

    # エラーメッセージ定数
    ERROR_MESSAGE_INVALID_REQUEST = 'リクエスト形式が正しくありません'
    FIELD_LABEL_NICKNAME = 'ニックネーム'
    FIELD_LABEL_BODY = '本文'

    def show
      post = Post.find(params[:id])
      judgments = Judgment.where(post_id: post.id).to_a
      rank = post.calculate_rank
      total_count = Post.total_scored_count
      render json: post.to_detail_json(judgments, rank, total_count)
    rescue Dynamoid::Errors::RecordNotFound => e
      # 非機能要件: エラー発生時にERRORレベルでログ出力（投稿ID・エラー内容を含む）
      Rails.logger.error("[PostsController#show] Not found: id=#{params[:id]} error=#{e.class} - #{e.message}")
      render_not_found
    end

    def create
      # レート制限チェック（投稿バリデーション前に実行）
      # バリデーションより先にチェックして、不要なDB操作を回避
      if RateLimiterService.limited?(ip: request.remote_ip, nickname: post_params[:nickname])
        render json: {
          error: ERROR_MESSAGE_RATE_LIMITED,
          code: ERROR_CODE_RATE_LIMITED
        }, status: :too_many_requests
        return
      end

      post = Post.new(post_params.merge(id: SecureRandom.uuid))

      if post.save
        # 投稿成功後にレート制限を設定
        begin
          RateLimiterService.set_limit!(ip: request.remote_ip, nickname: post_params[:nickname])
        rescue StandardError => e
          # set_limit!失敗時も投稿レスポンスを返す（フェイルオープン）
          Rails.logger.error("[PostsController#create] Rate limit set failed: #{e.class} - #{e.message}")
        end
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

    # 投稿が見つからない場合のエラーレスポンスを返す
    # @return [void] JSONレスポンスをレンダリング
    def render_not_found
      render json: {
        error: ERROR_MESSAGE_NOT_FOUND,
        code: ERROR_CODE_NOT_FOUND
      }, status: :not_found
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
