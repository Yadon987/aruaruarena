# frozen_string_literal: true

# OpenAiAdapter - OpenAI GPT-4o-mini API用アダプター
#
# BaseAiAdapterを継承し、OpenAI API固有の実装を提供します。
# 中尾彬風の審査員として投稿を採点します。
#
# @see https://platform.openai.com/docs/api-reference/chat
class OpenAiAdapter < BaseAiAdapter
  # 定数定義（GLMAdapterから変更）
  PROMPT_PATH = 'app/prompts/nakao.txt'
  BASE_URL = 'https://api.openai.com'
  MODEL_NAME = 'gpt-4o-mini'

  # 共通定数（GLMAdapterと同じ）
  MAX_COMMENT_LENGTH = 30
  TEMPERATURE = 0.7
  MAX_TOKENS = 1000
  ERROR_CODE_INVALID_RESPONSE = 'invalid_response'

  # プロンプトキャッシュ（GLMAdapterと同じ）
  @prompt_cache = nil
  @prompt_mutex = Mutex.new

  class << self
    def prompt_cache
      @prompt_mutex.synchronize { @prompt_cache }
    end

    def prompt_cache=(value)
      @prompt_mutex.synchronize { @prompt_cache = value }
    end

    def reset_prompt_cache!
      @prompt_mutex.synchronize { @prompt_cache = nil }
    end
  end

  def initialize
    super
    @prompt = load_prompt
  end

  private

  # GLMAdapterからコピー（そのまま使用）
  def load_prompt
    cached = self.class.prompt_cache
    return cached if cached

    raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出' if PROMPT_PATH.include?('..') || PROMPT_PATH.start_with?('/')
    raise ArgumentError, "プロンプトファイルが見つかりません: #{PROMPT_PATH}" unless File.exist?(PROMPT_PATH)

    prompt = File.read(PROMPT_PATH)
    self.class.prompt_cache = prompt
    prompt
  end

  # GLMAdapterからSSL設定を追加
  def client
    @client ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json
      f.options.timeout = BASE_TIMEOUT
      f.ssl.verify = true # SSL証明書検証を有効化（重要）
      f.adapter Faraday.default_adapter
    end
  end

  # GLMAdapterから環境変数名のみ変更
  def api_key
    # rubocop:disable Style/FetchEnvVar
    key = ENV['OPENAI_API_KEY'] # GLM_API_KEY → OPENAI_API_KEY
    # rubocop:enable Style/FetchEnvVar
    raise ArgumentError, 'OPENAI_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # GLMAdapterからそのままコピー
  def invalid_response_error
    JudgmentResult.new(succeeded: false, error_code: ERROR_CODE_INVALID_RESPONSE, scores: nil, comment: nil)
  end

  # GLMAdapterからそのままコピー（モデル名は自動的に定数を使用）
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

  # GLMAdapterからエンドポイントのみ変更
  def execute_request(request_body)
    response = client.post('v1/chat/completions') do |req| # chat/completions → v1/chat/completions
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.body = request_body
    end

    handle_response_status(response)
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("OpenAI APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("OpenAI API接続エラー: #{e.class}")
    raise
  end

  # GLMAdapterからコメント内の"GLM" → "OpenAI"に変更
  def handle_response_status(response)
    case response.status
    when 200..299
      Rails.logger.info('OpenAI API呼び出し成功')
      response
    when 429
      Rails.logger.warn("OpenAI APIレート制限: #{response.body}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    when 400..499
      Rails.logger.error("OpenAI APIクライアントエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
    when 500..599
      Rails.logger.error("OpenAI APIサーバーエラー: #{response.status} - #{response.body}")
      raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
    else
      Rails.logger.error("OpenAI API未知のエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
    end
  end

  # GLMAdapterからそのままコピー
  def parse_response(response)
    body = response.body
    parsed = body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body

    content = parsed.dig(:choices, 0, :message, :content)
    unless content
      Rails.logger.error('OpenAI APIレスポンスにcontentが含まれていません')
      return invalid_response_error
    end

    json_text = extract_json_from_codeblock(content)

    begin
      data = JSON.parse(json_text, symbolize_names: true)
    rescue JSON::ParserError => e
      Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")
      return invalid_response_error
    end

    begin
      scores = convert_scores_to_integers(data)
    rescue ArgumentError => e
      Rails.logger.error("スコア変換エラー: #{e.message}")
      return invalid_response_error
    end

    comment = truncate_comment(data[:comment])

    {
      scores: scores,
      comment: comment
    }
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    invalid_response_error
  end

  # GLMAdapterからそのままコピー
  def extract_json_from_codeblock(text)
    if text.include?('```')
      if text.match?(/```json/)
        extracted = text.slice(/```json\s*\n(.*?)\n```/m, 1)
        return extracted.strip if extracted
      end

      extracted = text.slice(/```\s*\n(.*?)\n```/m, 1)
      return extracted.strip if extracted
    end
    text
  end

  # GLMAdapterからそのままコピー
  def convert_scores_to_integers(data)
    scores = {}
    REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]
      raise ArgumentError, "Score value is nil for #{key}" if value.nil?

      begin
        integer_value = if value.is_a?(Integer)
                          value
                        else
                          Float(value).round
                        end
      rescue ArgumentError, FloatDomainError, RangeError, TypeError => e
        raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}", cause: e
      end
      scores[key] = integer_value
    end
    scores
  end

  # GLMAdapterからそのままコピー
  def truncate_comment(comment)
    return nil if comment.nil?

    comment.to_s.strip[0...MAX_COMMENT_LENGTH]
  end
end
