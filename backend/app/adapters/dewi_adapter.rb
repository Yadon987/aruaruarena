# frozen_string_literal: true

# DewiAdapter - ZhipuAI GLM-4-Flash API用アダプター
#
# BaseAiAdapterを継承し、GLM API固有の実装を提供します。
# デヴィ婦人風の審査員として投稿を採点します。
#
# @see https://open.bigmodel.cn/dev/api#glm-4
class DewiAdapter < BaseAiAdapter
  include JsonParserConcern

  # プロンプトファイルのパス
  PROMPT_PATH = Rails.root.join('app/prompts/dewi.txt').to_s

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

  # プロンプトのキャッシュ（スレッドセーフ）
  @prompt_cache = nil
  @prompt_mutex = Mutex.new

  class << self
    # キャッシュされたプロンプトを取得する
    def prompt_cache
      @prompt_mutex.synchronize { @prompt_cache }
    end

    # キャッシュされたプロンプトを設定する
    def prompt_cache=(value)
      @prompt_mutex.synchronize { @prompt_cache = value }
    end

    # プロンプトキャッシュをリセットする（テスト用）
    def reset_prompt_cache!
      @prompt_mutex.synchronize { @prompt_cache = nil }
    end
  end

  # DewiAdapterを初期化する
  def initialize
    super
    @prompt = load_prompt
  end

  private

  # プロンプトファイルを読み込む
  def load_prompt
    cached = self.class.prompt_cache
    return cached if cached

    raise ArgumentError, "プロンプトファイルが見つかりません: #{PROMPT_PATH}" unless File.exist?(PROMPT_PATH)

    prompt = File.read(PROMPT_PATH)
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
    # rubocop:disable Style/FetchEnvVar
    key = ENV['GLM_API_KEY']
    # rubocop:enable Style/FetchEnvVar
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
    response = client.post('chat/completions') do |req|
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.body = request_body
    end

    handle_response_status(response)
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("GLM APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("GLM API接続エラー: #{e.class}")
    raise
  end

  # ステータスコードをチェックする
  def handle_response_status(response)
    case response.status
    when 200..299
      Rails.logger.info('GLM API呼び出し成功')
      response
    when 429
      Rails.logger.warn("GLM APIレート制限: status=#{response.status}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    when 400..499
      Rails.logger.error("GLM APIクライアントエラー: status=#{response.status}")
      raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
    when 500..599
      Rails.logger.error("GLM APIサーバーエラー: status=#{response.status}")
      raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
    else
      Rails.logger.error("GLM API未知のエラー: status=#{response.status}")
      raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
    end
  end

  # レスポンスを解析する
  def parse_response(response)
    body = response.body
    # FaradayミドルウェアでJSONパース済みの場合と未パースの場合を考慮（テスト時はmockなので文字列の場合あり）
    parsed = body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body

    content = parsed.dig(:choices, 0, :message, :content)
    unless content
      Rails.logger.error('GLM APIレスポンスにcontentが含まれていません')
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

    comment = truncate_comment(data[:comment], max_length: MAX_COMMENT_LENGTH)

    {
      scores: scores,
      comment: comment
    }
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    invalid_response_error
  end
end
