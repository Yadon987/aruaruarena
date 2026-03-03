# frozen_string_literal: true

# GeminiAdapter - Gemini 2.0 Flash Experimental API用アダプター
#
# BaseAiAdapterを継承し、Gemini API固有の実装を提供します。
# ひろゆき風の審査員として投稿を採点します。
#
# @see https://ai.google.dev/gemini-api/docs
class GeminiAdapter < BaseAiAdapter
  include JsonParserConcern

  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/hiroyuki.txt'

  # Gemini APIのベースURL
  BASE_URL = 'https://generativelanguage.googleapis.com'

  # Gemini 2.5 Flashモデル
  MODEL_NAME = 'gemini-2.5-flash'

  # APIバージョン
  API_VERSION = 'v1beta'

  # レスポンスの最大長（コメント用）
  MAX_COMMENT_LENGTH = 30

  # 生成パラメータ
  TEMPERATURE = 0.7
  MAX_OUTPUT_TOKENS = 1000

  # エラーコード
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'

  RESPONSE_SCHEMA = {
    type: 'OBJECT',
    required: %w[empathy humor brevity originality expression comment],
    properties: {
      empathy: { type: 'INTEGER' },
      humor: { type: 'INTEGER' },
      brevity: { type: 'INTEGER' },
      originality: { type: 'INTEGER' },
      expression: { type: 'INTEGER' },
      comment: { type: 'STRING' }
    }
  }.freeze

  # プロンプトのキャッシュ（スレッドセーフ）
  @prompt_cache = nil
  @prompt_mutex = Mutex.new

  class << self
    # キャッシュされたプロンプトを取得する
    #
    # @return [String, nil] キャッシュされたプロンプト
    def prompt_cache
      @prompt_mutex.synchronize do
        @prompt_cache
      end
    end

    # キャッシュされたプロンプトを設定する
    #
    # @param value [String] プロンプト文字列
    def prompt_cache=(value)
      @prompt_mutex.synchronize do
        @prompt_cache = value
      end
    end

    # プロンプトキャッシュをリセットする（テスト用）
    #
    # @return [void]
    def reset_prompt_cache!
      @prompt_mutex.synchronize do
        @prompt_cache = nil
      end
    end
  end

  # GeminiAdapterを初期化する
  #
  # プロンプトファイルを読み込み、キャッシュします。
  #
  # @raise [ArgumentError] プロンプトファイルが見つからない場合
  def initialize
    super
    @prompt = load_prompt
  end

  private

  # 無効なレスポンスエラーを返す
  #
  # @return [JudgmentResult] 失敗結果
  def invalid_response_error
    JudgmentResult.new(succeeded: false, error_code: ERROR_CODE_INVALID_RESPONSE, scores: nil, comment: nil)
  end

  # プロンプトファイルを読み込む
  #
  # クラスレベルでキャッシュされ、全インスタンスで共有されます。
  #
  # @raise [ArgumentError] ファイルが見つからない場合、またはパストラバーサル検出時
  # @return [String] プロンプト文字列
  def load_prompt
    # キャッシュがあればそれを返す
    cached = self.class.prompt_cache
    return cached if cached

    # パストラバーサルチェック
    raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出' if PROMPT_PATH.include?('..') || PROMPT_PATH.start_with?('/')

    raise ArgumentError, "プロンプトファイルが見つかりません: #{PROMPT_PATH}" unless File.exist?(PROMPT_PATH)

    prompt = File.read(PROMPT_PATH)
    self.class.prompt_cache = prompt
    prompt
  end

  # Faraday HTTPクライアントを返す
  #
  # SSL証明書検証が有効化されています。
  # タイムアウトは親クラスのBASE_TIMEOUT（20秒）を使用します。
  #
  # @return [Faraday::Connection] HTTPクライアント
  def client
    @client ||= Faraday.new(url: BASE_URL) do |f|
      f.request :url_encoded
      f.options.timeout = BASE_TIMEOUT
      f.ssl.verify = true # SSL証明書検証を有効化
      f.adapter Faraday.default_adapter
    end
  end

  # Gemini API用のリクエストを構築する
  #
  # プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。
  # Gemini APIはgenerateContentエンドポイントを使用し、
  # contents配列に会話のターンを含めます。
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID（現状はhiroyukiのみ対応）
  # @return [Hash] APIリクエストボディ
  def build_request(post_content, _persona)
    {
      contents: [
        {
          parts: [
            { text: prompt_text(post_content) }
          ]
        }
      ],
      generationConfig: generation_config
    }
  end

  # Gemini APIレスポンスからテキストを抽出する
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [String] 抽出されたテキスト
  # @raise [ArgumentError] candidates構造が無効な場合
  # @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合
  def extract_text_from_response(response)
    join_part_texts(valid_response_parts(response))
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    raise
  end

  # Gemini APIのレスポンスを解析してHash形式に変換する
  #
  # AIから返されたJSONをパースし、スコアとコメントを抽出します。
  # コードブロックで囲まれたJSONも解析可能です。
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果
  def parse_response(response)
    text = extract_response_text(response)
    return invalid_response_error unless text

    build_result_from_text(text)
  end

  # Gemini APIキーを返す
  #
  # @return [String] APIキー
  # @raise [ArgumentError] APIキーが設定されていない場合
  def api_key
    if ENV.fetch('SECRETS_MANAGER_ENABLED', 'false') == 'true'
      return SecretsManagerClient.get_api_key(
        secret_arn: ENV.fetch('GEMINI_SECRET_ARN', nil),
        env_key: 'GEMINI_API_KEY'
      )
    end

    key = ENV.fetch('GEMINI_API_KEY', nil)
    raise ArgumentError, 'GEMINI_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # Gemini APIにHTTPリクエストを送信する
  #
  # @param request_body [Hash] APIリクエストボディ
  # @return [Faraday::Response] HTTPレスポンス
  def execute_request(request_body)
    handle_response_status(send_request(request_body))
  rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
    log_request_error(e)
    raise
  end

  def prompt_text(post_content)
    @prompt.gsub('{post_content}', post_content)
  end

  def generation_config
    {
      temperature: TEMPERATURE, # 創造性のバランス（0.0-1.0）
      maxOutputTokens: MAX_OUTPUT_TOKENS, # 最大出力トークン数
      responseMimeType: 'application/json', # JSONモードを強制
      responseSchema: RESPONSE_SCHEMA
    }
  end

  def valid_response_parts(response)
    parts = response_parts(response)
    return parts if valid_parts?(parts)

    Rails.logger.error('Gemini APIレスポンスにcandidatesが含まれていません')
    raise ArgumentError, 'Invalid candidates structure'
  end

  def response_parts(response)
    parsed = JSON.parse(response.body, symbolize_names: true)
    parsed.dig(:candidates, 0, :content, :parts)
  end

  def valid_parts?(parts)
    parts.is_a?(Array) && parts.any? { |part| part[:text].present? }
  end

  def join_part_texts(parts)
    parts.filter_map { |part| part[:text] }.join
  end

  def extract_response_text(response)
    extract_text_from_response(response)
  rescue ArgumentError, JSON::ParserError => e
    Rails.logger.error("テキスト抽出エラー: #{e.class} - #{e.message}")
    nil
  end

  def build_result_from_text(text)
    data = parse_json_payload(text)
    { scores: convert_scores_to_integers(data), comment: truncate_comment(data[:comment]) }
  rescue JSON::ParserError => e
    Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")
    Rails.logger.error("元のレスポンステキスト(先頭200文字): #{text.to_s.truncate(200)}")
    invalid_response_error
  rescue ArgumentError => e
    Rails.logger.error("スコア変換エラー: #{e.message}")
    invalid_response_error
  end

  def send_request(request_body)
    client.post(api_endpoint) do |req|
      req.params[:key] = api_key
      req.headers['Content-Type'] = 'application/json'
      req.body = JSON.generate(request_body)
    end
  end

  def api_endpoint
    "#{API_VERSION}/models/#{MODEL_NAME}:generateContent"
  end

  def handle_response_status(response)
    return log_successful_response(response) if response.status.between?(200, 299)
    return raise_rate_limit_error(response) if response.status == 429
    return raise_client_error(response) if response.status.between?(400, 499)
    return raise_server_error(response) if response.status.between?(500, 599)

    raise_unknown_error(response)
  end

  def log_successful_response(response)
    Rails.logger.info('Gemini API呼び出し成功')
    response
  end

  def raise_rate_limit_error(response)
    Rails.logger.warn("Gemini APIレート制限: #{response.body}")
    raise Faraday::ClientError.new('rate limit', faraday_response: response)
  end

  def raise_client_error(response)
    Rails.logger.error("Gemini APIクライアントエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
  end

  def raise_server_error(response)
    Rails.logger.error("Gemini APIサーバーエラー: #{response.status} - #{response.body}")
    raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
  end

  def raise_unknown_error(response)
    Rails.logger.error("Gemini API未知のエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
  end

  def log_request_error(error)
    level = error.is_a?(Faraday::TimeoutError) ? :warn : :error
    message = error.is_a?(Faraday::TimeoutError) ? 'タイムアウト' : '接続エラー'
    Rails.logger.public_send(level, "Gemini API#{message}: #{error.class}")
  end
end
