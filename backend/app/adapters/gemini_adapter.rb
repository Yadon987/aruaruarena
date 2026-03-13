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
  TEMPERATURE = 0.0
  TOP_P = 0.1
  TOP_K = 1
  MAX_OUTPUT_TOKENS = 192
  INVALID_RESPONSE_MAX_RETRIES = 2
  SYNC_REJUDGE_INVALID_RESPONSE_MAX_RETRIES = 0
  INVALID_RESPONSE_LOG_LENGTH = 160

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
  def initialize(context: :default)
    super
    @prompt = load_prompt
  end

  private

  # 無効なレスポンスエラーを返す
  #
  # @return [JudgmentResult] 失敗結果
  def invalid_response_error = invalid_response_result

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
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID（現状はhiroyukiのみ対応）
  # @return [Hash] APIリクエストボディ
  def build_request(post_content, _persona)
    {
      systemInstruction: {
        parts: [
          { text: system_instruction_text }
        ]
      },
      contents: [
        {
          parts: [
            { text: user_content_text(post_content) }
          ]
        }
      ],
      generationConfig: generation_config
    }
  end

  def build_fallback_request(post_content, _persona)
    {
      systemInstruction: {
        parts: [
          { text: fallback_system_instruction_text }
        ]
      },
      contents: [
        {
          parts: [
            { text: user_content_text(post_content) }
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
  def parse_response(response, allow_fallback: true)
    text = extract_response_text(response)
    return invalid_response_error unless text

    result = build_result_from_text(text)
    return result unless allow_fallback && invalid_response_result?(result)

    log_invalid_response(reason: classify_invalid_text(text), text: text, source: 'primary')
    result
  end

  def call_ai_api(post_content, persona)
    result = perform_gemini_request(build_request(post_content, persona), allow_fallback: true)
    return result unless invalid_response_result?(result)

    Rails.logger.warn('Gemini invalid_responseのため簡易プロンプトで再実行します')
    result = perform_gemini_request(build_fallback_request(post_content, persona), allow_fallback: false)
    return result unless invalid_response_result?(result)

    provider_fallback_result(post_content, persona)
  rescue Faraday::ClientError, Faraday::ServerError, Faraday::TimeoutError, Faraday::ConnectionFailed => e
    Rails.logger.warn("Gemini provider系エラーのためGroq互換へフォールバックします: #{e.class}")
    provider_fallback_result(post_content, persona, original_error: e)
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

  def system_instruction_text
    @prompt
  end

  def user_content_text(post_content)
    post_content
  end

  def fallback_system_instruction_text
    <<~PROMPT
      あなたは採点専用の整形器です。
      次の投稿を採点し、指定のJSONオブジェクトを1つだけ返してください。
      説明文、前置き、後書き、コードブロック、改行だけの行、配列は出力禁止です。
      comment にはダブルクォーテーション、改行、中括弧を含めないでください。

      出力形式:
      {"empathy":0,"humor":0,"brevity":0,"originality":0,"expression":0,"comment":"30文字以内"}
    PROMPT
  end

  def generation_config
    {
      temperature: TEMPERATURE, # 創造性のバランス（0.0-1.0）
      topP: TOP_P,
      topK: TOP_K,
      maxOutputTokens: MAX_OUTPUT_TOKENS, # 最大出力トークン数
      candidateCount: 1,
      responseMimeType: 'application/json', # JSONモードを強制
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 }
    }
  end

  def retryable_result_max_retries
    return SYNC_REJUDGE_INVALID_RESPONSE_MAX_RETRIES if sync_rejudge_context?

    INVALID_RESPONSE_MAX_RETRIES
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
    return false unless parts.is_a?(Array)

    non_thought = parts.reject { |part| part[:thought] == true }
    non_thought.is_a?(Array) && non_thought.any? { |part| part[:text].present? }
  end

  def join_part_texts(parts)
    parts
      .reject { |part| part[:thought] == true }
      .filter_map { |part| part[:text] }
      .join
  end

  def extract_response_text(response)
    extract_text_from_response(response)
  rescue ArgumentError, JSON::ParserError => e
    Rails.logger.error("テキスト抽出エラー: #{e.class} - #{e.message}")
    log_invalid_response(reason: 'text_extraction_error', source: 'response_body')
    nil
  end

  def build_result_from_text(text)
    data = parse_json_payload(text)
    { scores: convert_scores_to_integers(data), comment: truncate_comment(data[:comment]) }
  rescue JSON::ParserError => e
    Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")
    log_invalid_response(reason: classify_invalid_text(text), text: text, source: 'json_parse')
    invalid_response_error
  rescue ArgumentError => e
    Rails.logger.error("スコア変換エラー: #{e.message}")
    log_invalid_response(reason: 'score_conversion_error', text: text, source: 'score_parse')
    invalid_response_error
  end

  def perform_gemini_request(request_body, allow_fallback:)
    response = execute_request(request_body)
    parse_result = parse_response(response, allow_fallback: allow_fallback)
    return parse_result if parse_result.is_a?(JudgmentResult)

    build_judgment_result(parse_result)
  end

  def provider_fallback_result(post_content, persona, original_error: nil)
    if original_error
      Rails.logger.warn('Gemini provider系エラー継続のためGroq互換へフォールバックします')
    else
      Rails.logger.warn('Gemini invalid_response継続のためGroq互換へフォールバックします')
    end

    HiroyukiFallbackAdapter.new(context: request_context).judge(post_content, persona: persona)
  rescue StandardError => e
    Rails.logger.error("Gemini代替プロバイダ失敗: #{e.class} - #{e.message}")
    return handle_error(original_error) if original_error

    invalid_response_error
  end

  def invalid_response_result?(result)
    result.is_a?(JudgmentResult) && result.error_code == ERROR_CODE_INVALID_RESPONSE
  end

  def classify_invalid_text(text)
    normalized = text.to_s
    return 'blank_text' if normalized.blank?
    return 'no_json_object' unless normalized.include?('{')
    return 'truncated_json' if likely_truncated_json?(normalized)
    return 'prose_wrapped_json' if prose_wrapped_json?(normalized)

    'schema_mismatch'
  end

  def likely_truncated_json?(text)
    text.count('{') > text.count('}') || text.rstrip.end_with?(':', ',', '"')
  end

  def prose_wrapped_json?(text)
    stripped = text.strip
    stripped !~ /\A\{.*\}\z/m
  end

  def log_invalid_response(reason:, source:, text: nil)
    Rails.logger.warn(
      "[GeminiAdapter] invalid_response分類: reason=#{reason}, source=#{source}, sample=#{safe_response_excerpt(text)}"
    )
  end

  def safe_response_excerpt(text)
    text.to_s.gsub(/\s+/, ' ').strip.truncate(INVALID_RESPONSE_LOG_LENGTH)
  end

  def send_request(request_body)
    client.post(api_endpoint) do |req|
      req.headers['x-goog-api-key'] = api_key
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
