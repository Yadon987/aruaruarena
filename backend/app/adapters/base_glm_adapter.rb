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
