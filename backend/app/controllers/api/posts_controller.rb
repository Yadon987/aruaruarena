# frozen_string_literal: true

module Api
  # 投稿APIコントローラー
  class PostsController < ApplicationController
    before_action :validate_content_type, only: %i[create rejudge]
    # Cache-Control設定
    # 投稿詳細: 1時間（3600秒）- 投稿内容が変わる可能性を考慮して短期キャッシュ
    CACHE_CONTROL_POST_DETAIL = 'max-age=3600, public'
    CACHE_CONTROL_NO_STORE = 'no-store'

    # エラーコード定数
    ERROR_CODE_VALIDATION = 'VALIDATION_ERROR'
    ERROR_CODE_BAD_REQUEST = 'BAD_REQUEST'
    ERROR_CODE_NOT_FOUND = 'NOT_FOUND'
    ERROR_CODE_DUPLICATE_CONTENT = 'DUPLICATE_CONTENT'
    ERROR_CODE_INVALID_STATUS = 'INVALID_STATUS'
    ERROR_CODE_INVALID_PERSONA = 'INVALID_PERSONA'
    ERROR_CODE_SECRETS_FETCH_FAILED = 'secrets_fetch_failed'
    ERROR_CODE_UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE'

    # エラーメッセージ定数
    ERROR_MESSAGE_NOT_FOUND = '投稿が見つかりません'
    ERROR_MESSAGE_DUPLICATE_CONTENT = '同じ内容の投稿があります'
    ERROR_MESSAGE_INVALID_STATUS = '再審査できないステータスです'
    ERROR_MESSAGE_INVALID_PERSONA = '無効な審査員IDです'
    ERROR_MESSAGE_SECRETS_FETCH_FAILED = 'シークレット取得に失敗しました'
    ERROR_MESSAGE_UNSUPPORTED_MEDIA_TYPE = 'Content-Type は application/json を指定してください'

    # エラーメッセージ定数
    ERROR_MESSAGE_INVALID_REQUEST = 'リクエスト形式が正しくありません'
    FIELD_LABEL_NICKNAME = 'ニックネーム'
    FIELD_LABEL_BODY = '本文'
    # rubocop:disable Metrics/MethodLength
    def show
      user_agent = request.headers['User-Agent']

      if OgpMetaTagService.crawler?(user_agent:)
        # クローラーの場合はHTMLを返す
        render_ogp_html
      else
        # 通常ユーザーの場合はJSONを返す
        render_json_response
      end
    rescue Dynamoid::Errors::RecordNotFound => e
      # 非機能要件: エラー発生時にERRORレベルでログ出力（投稿ID・エラー内容を含む）
      Rails.logger.error("[PostsController#show] Not found: id=#{params[:id]} error=#{e.class} - #{e.message}")
      render_not_found
    end

    def create
      # 重複チェック（バリデーションの前に実行）
      if DuplicateCheckService.duplicate?(body: post_params[:body])
        render json: {
          error: ERROR_MESSAGE_DUPLICATE_CONTENT,
          code: ERROR_CODE_DUPLICATE_CONTENT
        }, status: :unprocessable_content
        return
      end

      post = Post.new(post_params.merge(id: SecureRandom.uuid))
      post.request_ip = request.remote_ip

      if post.save
        LogOgpGenerationEventService.call(event: 'post_created', post:)

        # 投稿成功後にレート制限を設定
        unless RateLimiterService.set_limit!(ip: request.remote_ip, nickname: post_params[:nickname])
          # set_limit! が失敗を返しても投稿レスポンスは返す（フェイルオープン）
          Rails.logger.error('[PostsController#create] Rate limit set failed')
        end

        # 投稿成功後に重複チェックレコードを登録
        begin
          DuplicateCheckService.register!(body: post_params[:body], post_id: post.id)
        rescue StandardError => e
          # register!失敗時も投稿レスポンスを返す（フェイルオープン）
          Rails.logger.error("[PostsController#create] Duplicate check register failed: #{e.class} - #{e.message}")
        end

        verify_ai_secrets_before_enqueue!
        start_judgment_async(post)
        render json: { id: post.id, status: post.status }, status: :created
      else
        render_validation_error(post)
      end
    rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
      render_bad_request
    rescue ArgumentError => e
      raise unless secrets_fetch_error?(e)

      render_secrets_fetch_failed
    end

    def rejudge
      post = Post.find(params[:id])

      unless post.status == Post::STATUS_FAILED
        render_invalid_status
        return
      end

      RejudgePostService.call(post.id, failed_personas: rejudge_params)
      post.reload

      render json: { id: post.id, status: post.status }, status: :ok
    rescue Dynamoid::Errors::RecordNotFound
      render_not_found
    rescue ArgumentError
      render_invalid_persona
    rescue ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError
      render_bad_request
    end

    private

    def validate_content_type
      # JSONリクエストのみ許可（application/json）
      return if request.media_type == 'application/json'

      render json: {
        error: ERROR_MESSAGE_UNSUPPORTED_MEDIA_TYPE,
        code: ERROR_CODE_UNSUPPORTED_MEDIA_TYPE
      }, status: :unsupported_media_type
    end

    def post_params
      if params[:post].present?
        params[:post].permit(:nickname, :body)
      else
        params.permit(:nickname, :body)
      end
    end

    def rejudge_params
      raise ActionController::ParameterMissing, :failed_personas unless params.key?(:failed_personas)

      params[:failed_personas]
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

    # 再審査不可ステータスのエラーレスポンスを返す
    # @return [void] JSONレスポンスをレンダリング
    def render_invalid_status
      render json: {
        error: ERROR_MESSAGE_INVALID_STATUS,
        code: ERROR_CODE_INVALID_STATUS
      }, status: :unprocessable_content
    end

    # 不正な審査員指定のエラーレスポンスを返す
    # @return [void] JSONレスポンスをレンダリング
    def render_invalid_persona
      render json: {
        error: ERROR_MESSAGE_INVALID_PERSONA,
        code: ERROR_CODE_INVALID_PERSONA
      }, status: :unprocessable_content
    end

    def render_secrets_fetch_failed
      render json: {
        error: ERROR_MESSAGE_SECRETS_FETCH_FAILED,
        code: ERROR_CODE_SECRETS_FETCH_FAILED
      }, status: :internal_server_error
    end

    # 非同期で審査を開始する
    #
    # Thread.newでJudgePostServiceを非同期実行し、レスポンスには影響しないようにする
    # Thread内で例外が発生した場合はログに出力のみ行う
    #
    # @param post [Post] 投稿オブジェクト
    # @return [void]
    def start_judgment_async(post)
      JudgmentQueueService.enqueue(post.id)
    rescue StandardError => e
      raise e if secrets_fetch_error?(e)

      handle_judgment_error(e, post)
    end

    def verify_ai_secrets_before_enqueue!
      return unless should_verify_ai_secrets?

      secret_mappings.each do |secret_env_key, env_key|
        SecretsManagerClient.get_api_key(secret_arn: ENV.fetch(secret_env_key, nil), env_key: env_key)
      end
    end

    # Secrets Managerの事前検証が必要かどうかを判定する
    #
    # 通常は SECRETS_MANAGER_ENABLED=true のときだけ検証する。
    # ただし request spec では SecretsManagerClient が class_double に差し替わるため、
    # モック化されている場合も事前検証を実行して期待どおりに呼び出しを検証する。
    def should_verify_ai_secrets?
      ENV['SECRETS_MANAGER_ENABLED'] == 'true' || SecretsManagerClient.class != Class
    end

    def secret_mappings
      [
        %w[GEMINI_SECRET_ARN GEMINI_API_KEY],
        %w[CEREBRAS_SECRET_ARN CEREBRAS_API_KEY],
        %w[GROQ_SECRET_ARN GROQ_API_KEY]
      ]
    end

    def secrets_fetch_error?(error)
      return false unless error.is_a?(ArgumentError)

      # SecretsManagerClientで使用しているエラーメッセージ群に一致した場合のみ、
      # シークレット取得由来のエラーとして扱う。
      %w[
        secrets_fetch_failed
        secrets_parse_error
        シークレットが見つかりません
        アクセス権限がありません
      ].any? { |message| error.message.include?(message) }
    end

    # Thread内の例外を処理する
    #
    # Thread内で例外が発生してもレスポンスには影響しないため、
    # ERRORレベルでログを出力して監視可能にする
    #
    # @param error [Exception] 発生した例外
    # @param post [Post] 投稿オブジェクト
    def handle_judgment_error(error, post)
      Rails.logger.error("[JudgePostService] Failed: #{error.class} - #{error.message}")
      Rails.logger.error(error.backtrace.join("\n")) if Rails.env.development?
      post.update_status!(Post::STATUS_FAILED)
    rescue StandardError => e
      Rails.logger.error("[JudgePostService] Failed to update post status: #{e.class} - #{e.message}")
    end

    # クローラー向けOGPタグ付きHTMLをレンダリング
    # @return [void] HTMLレスポンスをレンダリング
    def render_ogp_html
      post = Post.find(params[:id])
      # スコア状態（scored）以外は404を返す
      return render_not_found unless post.status == 'scored'

      base_url = ENV.fetch('BASE_URL', 'https://example.com')
      html = OgpMetaTagService.generate_html(post:, base_url:)

      response.headers['Cache-Control'] = CACHE_CONTROL_POST_DETAIL
      # HEADリクエストでも同じパスを通る（Railsが自動的にbodyを除去）
      render body: html, content_type: 'text/html', status: :ok
    end

    # 通常ユーザー向けJSONをレンダリング
    # @return [void] JSONレスポンスをレンダリング
    def render_json_response
      post = Post.find(params[:id])
      judgments = Judgment.where(post_id: post.id).to_a
      rank = post.calculate_rank
      total_count = Post.total_scored_count
      response.headers['Cache-Control'] = cache_control_for(post)
      render json: post.to_detail_json(judgments, rank, total_count)
    end

    def cache_control_for(post)
      return CACHE_CONTROL_NO_STORE if post.status == Post::STATUS_JUDGING

      CACHE_CONTROL_POST_DETAIL
    end
    # rubocop:enable Metrics/MethodLength
  end
end
