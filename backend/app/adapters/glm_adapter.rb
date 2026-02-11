# frozen_string_literal: true

# GlmAdapter - GLM-4-Flash API用アダプター
#
# BaseAiAdapterを継承し、GLM API固有の実装を提供します。
# デヴィ婦人風の審査員として投稿を採点します。
#
# @see https://open.bigmodel.cn/dev/api
# rubocop:disable Metrics/ClassLength
class GlmAdapter < BaseAiAdapter
  # プロンプトファイルのパス
  PROMPT_PATH = 'app/prompts/dewi.txt'

  # GLM APIのベースURL
  BASE_URL = 'https://open.bigmodel.cn'

  # GLM-4-Flashモデル
  MODEL_NAME = 'glm-4-flash'

  # APIバージョン
  API_VERSION = 'v4'

  # エンドポイントパス
  ENDPOINT = '/api/paas/v4/chat/completions'

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

  # 無効なレスポンスエラーを返す
  # @return [JudgmentResult] 失敗結果
  def invalid_response_error
    JudgmentResult.new(
      succeeded: false,
      error_code: ERROR_CODE_INVALID_RESPONSE,
      scores: nil,
      comment: nil
    )
  end

  # プロンプトファイルを読み込む
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
      f.request :url_encoded
      f.options.timeout = BASE_TIMEOUT
      f.ssl.verify = true
      f.adapter Faraday.default_adapter
    end
  end

  # GLM API用のリクエストを構築する
  #
  # プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。
  # GLM APIはchat/completionsエンドポイントを使用し、
  # messages配列に会話のターンを含めます。
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID（現状はdewiのみ対応）
  # @return [Hash] APIリクエストボディ
  def build_request(post_content, _persona)
    # プロンプト内のプレースホルダーを置換
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

  # GLM APIレスポンスからテキストを抽出する
  # @param response [Faraday::Response] APIレスポンス
  # @return [String] 抽出されたテキスト
  # @raise [ArgumentError] choices構造が無効な場合
  # @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合
  # rubocop:disable Metrics/MethodLength
  def extract_text_from_response(response)
    # rubocop:enable Metrics/MethodLength
    body = response.body
    parsed = JSON.parse(body, symbolize_names: true)

    choices = parsed[:choices]
    unless choices&.first&.dig(:message, :content)
      Rails.logger.error('GLM APIレスポンスにchoicesが含まれていません')
      raise ArgumentError, 'Invalid choices structure'
    end

    choices.first[:message][:content]
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    raise
  end

  # スコアデータを整数に変換する
  #
  # @param data [Hash] パースされたJSONデータ
  # @return [Hash] 整数に変換されたスコア {empathy: 15, ...}
  # @raise [ArgumentError] 必須キーが欠落している場合、またはスコア値が無効な場合
  # rubocop:disable Metrics/MethodLength
  def convert_scores_to_integers(data)
    # rubocop:enable Metrics/MethodLength
    scores = {}
    REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]

      # nilチェック
      raise ArgumentError, "Score value is nil for #{key}" if value.nil?

      # 文字列や浮動小数点数を整数に変換
      # 小数点文字列（例: "12.5"）をサポートするため、Float経由で変換
      begin
        # すでに整数の場合はそのまま使用
        integer_value = if value.is_a?(Integer)
                          value
                        else
                          # Floatに変換してから四捨五入で整数に
                          # 例: "12.5" -> 12.5 -> 13, "15" -> 15.0 -> 15
                          Float(value).round
                        end
      rescue ArgumentError, FloatDomainError, RangeError, TypeError => e # rubocop:disable Lint/ShadowedException
        Rails.logger.error("スコア変換エラー: #{key}=#{value.inspect} - #{e.class}")
        raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}", cause: e
      end # rubocop:enable Lint/ShadowedException
      scores[key] = integer_value
    end
    scores
  end

  # GLM APIのレスポンスを解析してHash形式に変換する
  #
  # AIから返されたJSONをパースし、スコアとコメントを抽出します。
  # コードブロックで囲まれたJSONも解析可能です。
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果
  # rubocop:disable Metrics/MethodLength, Metrics/AbcSize
  def parse_response(response)
    # rubocop:enable Metrics/MethodLength, Metrics/AbcSize
    begin
      text = extract_text_from_response(response)
    rescue ArgumentError, JSON::ParserError => e
      Rails.logger.error("テキスト抽出エラー: #{e.class} - #{e.message}")
      return invalid_response_error
    end

    json_text = extract_json_from_codeblock(text)

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
    # コードブロックが含まれる場合のみ処理
    if text.include?('```')
      # 正規表現の解説:
      # /```json\s*\n(.*?)\n```/m  -> ```json と ``` の間のテキストを抽出
      #   - ```json\s*\n: ```json とそれに続く空白・改行にマッチ
      #   - (.*?): 非貪欲マッチでJSON部分をキャプチャ
      #   - \n```: 改行と ``` にマッチ
      #   - /m: マルチラインモード（. が改行にもマッチ）
      #
      # 例: 'Note: ```json\n{"a":1}\n```\nDone' -> '{"a":1}'
      if text.match?(/```json/)
        extracted = text.slice(/```json\s*\n(.*?)\n```/m, 1)
        return extracted.strip if extracted
      end

      # ```json がない場合（単に ``` のみの場合）
      # 例: '```\n{"a":1}\n```' -> '{"a":1}'
      extracted = text.slice(/```\s*\n(.*?)\n```/m, 1)
      return extracted.strip if extracted
    end

    # コードブロックがない場合はそのまま返す
    text
  end

  # コメントを最大長に切り詰める
  #
  # @param comment [String, nil] コメント
  # @return [String, nil] 切り詰められたコメント
  def truncate_comment(comment)
    return nil if comment.nil?

    comment.to_s.strip[0...MAX_COMMENT_LENGTH]
  end

  # GLM APIキーを返す
  #
  # @return [String] APIキー
  # @raise [ArgumentError] APIキーが設定されていません
  def api_key
    # rubocop:disable Style/FetchEnvVar
    key = ENV['GLM_API_KEY']
    # rubocop:enable Style/FetchEnvVar
    raise ArgumentError, 'GLM_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # GLM APIにHTTPリクエストを送信する
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [Faraday::Response] HTTPレスポンス
  def send_api_request(post_content, persona)
    request_body = build_request(post_content, persona)

    client.post(ENDPOINT) do |req|
      req.headers['Authorization'] = "Bearer #{api_key}"
      req.headers['Content-Type'] = 'application/json'
      req.body = JSON.generate(request_body)
    end
  end

  # ステータスコードに応じてレスポンスを処理する
  #
  # @param response [Faraday::Response] HTTPレスポンス
  # @return [JudgmentResult] 審査結果
  # @raise [Faraday::ClientError] クライアントエラー時
  # @raise [Faraday::ServerError] サーバーエラー時
  # rubocop:disable Metrics/MethodLength, Metrics/AbcSize
  def handle_response_status(response)
    # rubocop:enable Metrics/MethodLength, Metrics/AbcSize
    case response.status
    when 200..299
      Rails.logger.info('GLM API呼び出し成功')
      parse_result = parse_response(response)

      # JudgmentResultが返された場合はそのまま返す（エラー時）
      return parse_result if parse_result.is_a?(JudgmentResult)

      # Hashが返された場合は親クラスのcall_ai_apiでバリデーション
      parse_result
    when 429
      Rails.logger.warn("GLM APIレート制限: #{response.body}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    when 400..499
      Rails.logger.error("GLM APIクライアントエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
    when 500..599
      Rails.logger.error("GLM APIサーバーエラー: #{response.status} - #{response.body}")
      raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
    else
      Rails.logger.error("GLM API未知のエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
    end
  end

  # 親クラスのcall_ai_apiをオーバーライドしてHTTP通信を実装
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [JudgmentResult] 審査結果
  def call_ai_api(post_content, persona)
    response = send_api_request(post_content, persona)
    handle_response_status(response)
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("GLM APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("GLM API接続エラー: #{e.class}")
    raise
  end
  # rubocop:enable Metrics/ClassLength
end
