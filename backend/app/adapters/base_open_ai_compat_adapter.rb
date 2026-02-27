# frozen_string_literal: true

# BaseOpenAiCompatAdapter - OpenAI互換API（Chat Completions）用アダプターの基底クラス
#
# Cerebras, Groq, OpenRouterなどのOpenAI互換エンドポイントを持つサービスで共有されます。
class BaseOpenAiCompatAdapter < BaseAiAdapter
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
    response = client.post(api_endpoint) do |req|
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.body = request_body
    end

    handle_response_status(response)
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("#{self.class.name} APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("#{self.class.name} API接続エラー: #{e.class}")
    raise
  end

  # ステータスコードに応じてレスポンスを処理する
  def handle_response_status(response)
    case response.status
    when 200..299
      Rails.logger.info("#{self.class.name} API呼び出し成功")
      response
    when 429
      Rails.logger.warn("#{self.class.name} APIレート制限: #{response.body}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    else
      Rails.logger.error("#{self.class.name} APIエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Error: #{response.status}", faraday_response: response)
    end
  end

  # OpenAI互換のレスポンスを解析する
  def parse_response(response)
    body = response.body
    # Faradayのミドルウェア設定によっては文字列キーになる場合があるため柔軟に対応
    parsed = if body.is_a?(String)
               JSON.parse(body, symbolize_names: true)
             elsif body.respond_to?(:transform_keys)
               body.transform_keys(&:to_sym)
             else
               body
             end

    content = extract_content_from_response(parsed)

    return invalid_response_error if content.nil? || content.strip.empty?

    json_text = extract_json_from_codeblock(content)

    begin
      data = JSON.parse(json_text, symbolize_names: true)
      scores = convert_scores_to_integers(data)
      comment = truncate_comment(data[:comment])

      { scores: scores, comment: comment }
    rescue JSON::ParserError, ArgumentError => e
      Rails.logger.error("#{self.class.name} パースエラー: #{e.message}")
      invalid_response_error
    end
  end

  # レスポンスからコンテンツを抽出（Cerebrasの特殊な形式にも対応）
  def extract_content_from_response(parsed)
    choices = parsed[:choices] || parsed['choices']
    return nil unless choices.is_a?(Array) && choices.any?

    msg = choices[0][:message] || choices[0]['message']
    return nil unless msg

    # 通常のOpenAI形式は content。
    # Cerebras (gpt-oss-120b) 等、回答が reasoning に入るケースがあるため、フォールバック。
    content = msg[:content] || msg['content']
    content = msg[:reasoning] || msg['reasoning'] if content.nil? || content.to_s.strip.empty?

    content.to_s
  end

  # コードブロックからJSONを抽出（OpenAiAdapterと同等のロジック）
  def extract_json_from_codeblock(text)
    if text.include?('```')
      if text.match?(/```json/)
        extracted = text.slice(/```json\s*\n(.*?)\n?```/m, 1)
        return extracted.strip if extracted
      end
      extracted = text.slice(/```\s*\n(.*?)\n?```/m, 1)
      return extracted.strip if extracted
    end
    text
  end

  # スコアを整数に変換
  def convert_scores_to_integers(data)
    scores = {}
    REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]
      raise ArgumentError, "Score value is nil for #{key}" if value.nil?

      scores[key] = value.is_a?(Integer) ? value : Float(value).round
    end
    scores
  end

  # コメントを切り詰め
  def truncate_comment(comment)
    return nil if comment.nil?

    comment.to_s.strip[0...MAX_COMMENT_LENGTH]
  end

  # 無効なレスポンスエラー
  def invalid_response_error
    JudgmentResult.new(succeeded: false, error_code: ERROR_CODE_INVALID_RESPONSE, scores: nil, comment: nil)
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
