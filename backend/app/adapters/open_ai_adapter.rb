# frozen_string_literal: true

# OpenAiAdapter - OpenAI GPT-4o-mini API用アダプター
#
# BaseAiAdapterを継承し、OpenAI API固有の実装を提供します。
# 中尾彬風の審査員として投稿を採点します。
#
# @see https://platform.openai.com/docs/api-reference/chat
# @note 実装パターンはGLMAdapter/GeminiAdapterと共通化されています
class OpenAiAdapter < BaseAiAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/nakao.txt'

  # OpenAI APIのベースURL
  BASE_URL = 'https://api.openai.com'

  # GPT-4o-miniモデル
  MODEL_NAME = 'gpt-4o-mini'

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
    #
    # @return [String, nil] キャッシュされたプロンプト
    def prompt_cache
      @prompt_mutex.synchronize { @prompt_cache }
    end

    # キャッシュされたプロンプトを設定する
    #
    # @param value [String] プロンプト文字列
    def prompt_cache=(value)
      @prompt_mutex.synchronize { @prompt_cache = value }
    end

    # プロンプトキャッシュをリセットする（テスト用）
    #
    # @return [void]
    def reset_prompt_cache!
      @prompt_mutex.synchronize { @prompt_cache = nil }
    end
  end

  # OpenAiAdapterを初期化する
  #
  # プロンプトファイルを読み込み、キャッシュします。
  #
  # @raise [ArgumentError] プロンプトファイルが見つからない場合
  def initialize
    super
    @prompt = load_prompt
  end

  private

  # プロンプトファイルを読み込む
  #
  # クラスレベルでキャッシュされ、全インスタンスで共有されます。
  #
  # @raise [ArgumentError] ファイルが見つからない場合、またはパストラバーサル検出時
  # @return [String] プロンプト文字列
  def load_prompt
    cached = self.class.prompt_cache
    return cached if cached

    raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出' if PROMPT_PATH.include?('..') || PROMPT_PATH.start_with?('/')
    raise ArgumentError, "プロンプトファイルが見つかりません: #{PROMPT_PATH}" unless File.exist?(PROMPT_PATH)

    prompt = File.read(PROMPT_PATH)
    self.class.prompt_cache = prompt
    prompt
  end

  # Faraday HTTPクライアントを返す
  #
  # SSL証明書検証が有効化されています。
  # タイムアウトは親クラスのBASE_TIMEOUT（30秒）を使用します。
  #
  # @return [Faraday::Connection] HTTPクライアント
  def client
    @client ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json
      f.options.timeout = BASE_TIMEOUT
      f.ssl.verify = true # SSL証明書検証を有効化
      f.adapter Faraday.default_adapter
    end
  end

  # OpenAI APIキーを返す
  #
  # @return [String] APIキー
  # @raise [ArgumentError] APIキーが設定されていない場合
  def api_key
    # rubocop:disable Style/FetchEnvVar
    key = ENV['OPENAI_API_KEY'] # GLM_API_KEY → OPENAI_API_KEY
    # rubocop:enable Style/FetchEnvVar
    raise ArgumentError, 'OPENAI_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # 無効なレスポンスエラーを返す
  #
  # @return [JudgmentResult] 失敗結果
  def invalid_response_error
    JudgmentResult.new(succeeded: false, error_code: ERROR_CODE_INVALID_RESPONSE, scores: nil, comment: nil)
  end

  # OpenAI API用のリクエストを構築する
  #
  # プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。
  #
  # @param post_content [String] 投稿本文
  # @param _persona [String] 審査員ID（現状はnakaoのみ対応）
  # @return [Hash] APIリクエストボディ
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
  #
  # @param request_body [Hash] APIリクエストボディ
  # @return [Faraday::Response] HTTPレスポンス
  # @raise [Faraday::TimeoutError] タイムアウト時
  # @raise [Faraday::ConnectionFailed] 接続エラー時
  def execute_request(request_body)
    response = client.post('v1/chat/completions') do |req|
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

  # ステータスコードに応じてレスポンスを処理する
  #
  # @param response [Faraday::Response] HTTPレスポンス
  # @return [Faraday::Response] 成功時のレスポンス
  # @raise [Faraday::ClientError] クライアントエラー時
  # @raise [Faraday::ServerError] サーバーエラー時
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

  # OpenAI APIのレスポンスからコンテンツを抽出する
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [String] 抽出されたコンテンツ
  # @raise [ArgumentError] choices構造が無効な場合
  # @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合
  def extract_content_from_response(response)
    body = response.body
    parsed = body.is_a?(String) ? JSON.parse(body, symbolize_names: true) : body

    content = parsed.dig(:choices, 0, :message, :content)
    unless content
      Rails.logger.error('OpenAI APIレスポンスにcontentが含まれていません')
      raise ArgumentError, 'Invalid choices structure'
    end

    content
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    raise
  end

  # OpenAI APIのレスポンスを解析してHash形式に変換する
  #
  # AIから返されたJSONをパースし、スコアとコメントを抽出します。
  # コードブロックで囲まれたJSONも解析可能です。
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果
  def parse_response(response)
    begin
      content = extract_content_from_response(response)
    rescue ArgumentError, JSON::ParserError => e
      Rails.logger.error("コンテンツ抽出エラー: #{e.class} - #{e.message}")
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
  end

  # コードブロックからJSONを抽出する
  #
  # AIモデルがmarkdown形式のコードブロック（```json ... ```）で
  # JSONを返す場合に、コードブロック記号を除去して純粋なJSONを抽出します。
  #
  # @example コードブロック付きのJSON
  #   extract_json_from_codeblock('```json\n{"a":1}\n```') #=> '{"a":1}'
  # @example 周囲にテキストがある場合
  #   extract_json_from_codeblock('Note:\n```json\n{"a":1}\n```\nDone') #=> '{"a":1}'
  # @example 生のJSON
  #   extract_json_from_codeblock('{"a":1}') #=> '{"a":1}'
  #
  # @param text [String] 生のテキスト
  # @return [String] 抽出されたJSON文字列
  def extract_json_from_codeblock(text)
    if text.include?('```')
      if text.match?(/```json/)
        # \n? を追加してtrailing newlineをオプションに
        extracted = text.slice(/```json\s*\n(.*?)\n?```/m, 1)
        return extracted.strip if extracted
      end

      # \n? を追加してtrailing newlineをオプションに
      extracted = text.slice(/```\s*\n(.*?)\n?```/m, 1)
      return extracted.strip if extracted
    end
    text
  end

  # スコアデータを整数に変換する
  #
  # 文字列や浮動小数点数のスコアを整数に変換します。
  # 小数点文字列（例: "12.5"）をサポートするため、Float経由で変換し四捨五入します。
  #
  # @param data [Hash] パースされたJSONデータ
  # @return [Hash] 整数に変換されたスコア {empathy: 15, ...}
  # @raise [ArgumentError] 必須キーが欠落している場合、またはスコア値が無効な場合
  def convert_scores_to_integers(data)
    scores = {}
    REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]

      # nilチェック
      raise ArgumentError, "Score value is nil for #{key}" if value.nil?

      # 文字列や浮動小数点数を整数に変換
      # 小数点文字列（例: "12.5"）をサポートするため、Float経由で変換
      # 例: "12.5" -> 12.5 -> 13, "15" -> 15.0 -> 15
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

  # コメントを指定された最大長に切り詰める
  #
  # @param comment [String, nil] コメント文字列
  # @return [String, nil] 切り詰められたコメント、またはnil
  def truncate_comment(comment)
    return nil if comment.nil?

    comment.to_s.strip[0...MAX_COMMENT_LENGTH]
  end
end
