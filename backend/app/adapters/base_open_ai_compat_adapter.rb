# frozen_string_literal: true

# BaseOpenAiCompatAdapter - OpenAI互換API（Chat Completions）用アダプターの基底クラス
#
# Cerebras, Groq, OpenRouterなどのOpenAI互換エンドポイントを持つサービスで共有されます。
class BaseOpenAiCompatAdapter < BaseAiAdapter
  include JsonParserConcern

  # レスポンスの最大長（コメント用）
  MAX_COMMENT_LENGTH = 30

  # 生成パラメータのデフォルト
  TEMPERATURE = 0.7
  MAX_TOKENS = 1000

  # エラーコード
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'

  def initialize
    super
    @prompt = load_prompt
  end

  private

  # プロンプトファイルを読み込む
  def load_prompt
    cached = self.class.prompt_cache
    return cached if cached

    # サブクラスで定義された PROMPT_PATH を使用
    prompt_path = self.class::PROMPT_PATH
    raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出' if prompt_path.include?('..') || prompt_path.start_with?('/')
    raise ArgumentError, "プロンプトファイルが見つかりません: #{prompt_path}" unless File.exist?(prompt_path)

    prompt = File.read(prompt_path)
    self.class.prompt_cache = prompt
    prompt
  end

  # Faraday HTTPクライアントを返す
  def client
    @client ||= Faraday.new(url: api_base_url) do |f|
      f.request :json
      f.response :json
      f.options.timeout = BASE_TIMEOUT
      f.ssl.verify = true
      f.adapter Faraday.default_adapter
    end
  end

  # OpenAI互換のリクエストを構築する
  def build_request(post_content, _persona)
    prompt_text = @prompt.gsub('{post_content}', post_content)

    {
      model: model_name,
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

  # ステータスコードに応じてレスポンスを処理する
  def handle_response_status(response)
    return log_successful_response(response) if response.status.between?(200, 299)
    return raise_rate_limit_error(response) if response.status == 429

    raise_unexpected_response_error(response)
  end

  # OpenAI互換のレスポンスを解析する
  def parse_response(response)
    content = extract_content_from_response(normalize_response_body(response.body))
    return invalid_response_error if blank_content?(content)

    build_parsed_result(content)
  end

  # レスポンスからコンテンツを抽出（Cerebrasの特殊な形式にも対応）
  def extract_content_from_response(parsed)
    message = first_response_message(parsed)
    return nil unless message

    response_content_from(message).to_s
  end

  # 無効なレスポンスエラー
  def invalid_response_error
    JudgmentResult.new(succeeded: false, error_code: ERROR_CODE_INVALID_RESPONSE, scores: nil, comment: nil)
  end

  def send_request(request_body)
    client.post(api_endpoint) do |req|
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.body = request_body
    end
  end

  def log_request_error(error)
    level = error.is_a?(Faraday::TimeoutError) ? :warn : :error
    message = error.is_a?(Faraday::TimeoutError) ? 'タイムアウト' : '接続エラー'
    Rails.logger.public_send(level, "#{self.class.name} API#{message}: #{error.class}")
  end

  def log_successful_response(response)
    Rails.logger.info("#{self.class.name} API呼び出し成功")
    response
  end

  def raise_rate_limit_error(response)
    Rails.logger.warn("#{self.class.name} APIレート制限: #{response.body}")
    raise Faraday::ClientError.new('rate limit', faraday_response: response)
  end

  def raise_unexpected_response_error(response)
    Rails.logger.error("#{self.class.name} APIエラー: #{response.status} - #{response.body}")
    raise Faraday::ClientError.new("Error: #{response.status}", faraday_response: response)
  end

  def normalize_response_body(body)
    return JSON.parse(body, symbolize_names: true) if body.is_a?(String)
    return body.transform_keys(&:to_sym) if body.respond_to?(:transform_keys)

    body
  end

  def blank_content?(content)
    content.nil? || content.strip.empty?
  end

  def build_parsed_result(content)
    data = parse_json_payload(content)
    { scores: convert_scores_to_integers(data), comment: truncate_comment(data[:comment]) }
  rescue JSON::ParserError, ArgumentError => e
    log_parse_error(e, content)
    invalid_response_error
  end

  def log_parse_error(error, content)
    Rails.logger.error("#{self.class.name} パースエラー: #{error.message}")
    Rails.logger.warn("Raw Content: #{content.truncate(200)}")
  end

  def first_response_message(parsed)
    choices = parsed[:choices] || parsed['choices']
    return nil unless choices.is_a?(Array) && choices.any?

    choices.first[:message] || choices.first['message']
  end

  def response_content_from(message)
    content = message[:content] || message['content']
    return content unless blank_content?(content)

    message[:reasoning] || message['reasoning']
  end

  class << self
    # テスト用: クラスごとのプロンプトキャッシュをクリア
    def reset_prompt_cache!
      @prompt_mutex ||= Mutex.new
      @prompt_mutex.synchronize { @prompt_cache = nil }
    end

    def prompt_cache
      @prompt_mutex ||= Mutex.new
      @prompt_mutex.synchronize { @prompt_cache }
    end

    def prompt_cache=(value)
      @prompt_mutex ||= Mutex.new
      @prompt_mutex.synchronize { @prompt_cache = value }
    end
  end

  # サブクラスで実装が必要なメソッド
  def api_base_url
    raise NotImplementedError
  end

  def api_endpoint
    'chat/completions'
  end

  def model_name
    raise NotImplementedError
  end

  def api_key
    raise NotImplementedError
  end
end
