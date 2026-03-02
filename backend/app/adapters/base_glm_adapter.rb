# frozen_string_literal: true

# BaseGlmAdapter - ZhipuAI GLM-4-Flash API用の基底アダプター
#
# GlmAdapterとDewiAdapterの共通機能を抽出したクラスです。
# GLM API固有の実装を提供します。
#
# @see https://open.bigmodel.cn/dev/api#glm-4
class BaseGlmAdapter < BaseAiAdapter
  include JsonParserConcern

  # GLM APIのベースURL
  BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

  # 使用するモデル
  MODEL_NAME = 'glm-4-flash'

  # レスポンスの最大長（コメント用）
  MAX_COMMENT_LENGTH = 30

  # 生成パラメータ
  TEMPERATURE = 0.7
  MAX_TOKENS = 1000

  # エラーコード
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'

  class << self
    # サブクラス継承時にキャッシュ変数を初期化
    def inherited(subclass)
      super
      subclass.instance_variable_set(:@prompt_cache, nil)
      subclass.instance_variable_set(:@prompt_mutex, Mutex.new)
    end

    # キャッシュされたプロンプトを取得する
    attr_accessor :prompt_cache

    # キャッシュされたプロンプトを設定する

    # プロンプトキャッシュをリセットする（テスト用）
    def reset_prompt_cache!
      @prompt_cache = nil
    end
  end

  # BaseGlmAdapterを初期化する
  def initialize
    super
    @prompt = load_prompt
  end

  private

  # プロンプトファイルを読み込む
  # サブクラスでオーバーライドしてPROMPT_PATHを定義すること
  def load_prompt
    cached = self.class.prompt_cache
    return cached if cached

    # パストラバーサル対策
    prompt_path = self.class::PROMPT_PATH
    raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出' if prompt_path.include?('..') || prompt_path.start_with?('/')
    raise ArgumentError, "プロンプトファイルが見つかりません: #{prompt_path}" unless File.exist?(prompt_path)

    prompt = File.read(prompt_path)
    self.class.prompt_cache = prompt
    prompt
  end

  # Faraday HTTPクライアントを返す
  def client
    @client ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json
      f.options.timeout = BASE_TIMEOUT
      f.adapter Faraday.default_adapter
    end
  end

  # GLM APIキーを返す
  #
  # @return [String] APIキー
  # @raise [ArgumentError] APIキーが設定されていない場合
  def api_key
    key = ENV.fetch('GLM_API_KEY', nil)
    raise ArgumentError, 'GLM_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # 無効なレスポンスエラーを返す
  def invalid_response_error
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: ERROR_CODE_INVALID_RESPONSE,
      scores: nil,
      comment: nil
    )
  end

  # GLM API用のリクエストを構築する
  def build_request(post_content, _persona)
    prompt_text = @prompt.gsub('{post_content}', post_content)

    {
      model: MODEL_NAME,
      messages: [
        { role: 'user', content: prompt_text }
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    }
  end

  # HTTPリクエストを実行する
  def execute_request(request_body)
    handle_response_status(send_request(request_body))
  rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
    log_request_error(e)
    raise
  end

  # ステータスコードをチェックする
  def handle_response_status(response)
    return log_successful_response(response) if response.status.between?(200, 299)
    return raise_rate_limit_error(response) if response.status == 429
    return raise_client_error(response) if response.status.between?(400, 499)
    return raise_server_error(response) if response.status.between?(500, 599)

    raise_unknown_error(response)
  end

  # レスポンスを解析する
  def parse_response(response)
    content = extract_content_from_response(response)
    return invalid_response_error unless content

    build_parsed_result(content)
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    invalid_response_error
  end

  def send_request(request_body)
    client.post('chat/completions') do |req|
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.body = request_body
    end
  end

  def log_request_error(error)
    level = error.is_a?(Faraday::TimeoutError) ? :warn : :error
    message = error.is_a?(Faraday::TimeoutError) ? 'タイムアウト' : '接続エラー'
    Rails.logger.public_send(level, "GLM API#{message}: #{error.class}")
  end

  def log_successful_response(response)
    Rails.logger.info('GLM API呼び出し成功')
    response
  end

  def raise_rate_limit_error(response)
    Rails.logger.warn("GLM APIレート制限: status=#{response.status}")
    raise Faraday::ClientError.new('rate limit', faraday_response: response)
  end

  def raise_client_error(response)
    Rails.logger.error("GLM APIクライアントエラー: status=#{response.status}")
    raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
  end

  def raise_server_error(response)
    Rails.logger.error("GLM APIサーバーエラー: status=#{response.status}")
    raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
  end

  def raise_unknown_error(response)
    Rails.logger.error("GLM API未知のエラー: status=#{response.status}")
    raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
  end

  def extract_content_from_response(response)
    parsed = parse_response_body(response.body)
    content = parsed.dig(:choices, 0, :message, :content)
    return content if content

    Rails.logger.error('GLM APIレスポンスにcontentが含まれていません')
    nil
  end

  def parse_response_body(body)
    body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body
  end

  def build_parsed_result(content)
    data = parse_json_payload(content)
    parsed_result_hash(data)
  rescue JSON::ParserError => e
    Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")
    Rails.logger.warn("Raw Content: #{content.truncate(200)}")
    invalid_response_error
  rescue ArgumentError => e
    Rails.logger.error("スコア変換エラー: #{e.message}")
    invalid_response_error
  end

  def parsed_result_hash(data)
    {
      scores: convert_scores_to_integers(data),
      comment: truncate_comment(data[:comment], max_length: MAX_COMMENT_LENGTH)
    }
  end
end
