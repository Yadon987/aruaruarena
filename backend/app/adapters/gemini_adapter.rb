# frozen_string_literal: true

# GeminiAdapter - Gemini 2.0 Flash Experimental API用アダプター
#
# BaseAiAdapterを継承し、Gemini API固有の実装を提供します。
# ひろゆき風の審査員として投稿を採点します。
#
# @see https://ai.google.dev/gemini-api/docs
class GeminiAdapter < BaseAiAdapter
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
  # タイムアウトは親クラスのBASE_TIMEOUT（30秒）を使用します。
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
    # プロンプト内のプレースホルダーを置換
    prompt_text = @prompt.gsub('{post_content}', post_content)

    {
      contents: [
        {
          parts: [
            { text: prompt_text }
          ]
        }
      ],
      generationConfig: {
        temperature: TEMPERATURE, # 創造性のバランス（0.0-1.0）
        maxOutputTokens: MAX_OUTPUT_TOKENS # 最大出力トークン数
      }
    }
  end

  # Gemini APIレスポンスからテキストを抽出する
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [String] 抽出されたテキスト
  # @raise [ArgumentError] candidates構造が無効な場合
  # @raise [JSON::ParserError] APIレスポンスが有効なJSONでない場合
  def extract_text_from_response(response)
    body = response.body
    parsed = JSON.parse(body, symbolize_names: true)

    candidates = parsed[:candidates]
    unless candidates&.first&.dig(:content, :parts)&.first&.dig(:text)
      Rails.logger.error('Gemini APIレスポンスにcandidatesが含まれていません')
      raise ArgumentError, 'Invalid candidates structure'
    end

    candidates.first[:content][:parts].first[:text]
  rescue JSON::ParserError => e
    Rails.logger.error("APIレスポンスのJSONパースエラー: #{e.message}")
    raise
  end

  # スコアデータを整数に変換する
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
      begin
        # すでに整数の場合はそのまま使用
        integer_value = if value.is_a?(Integer)
                          value
                        else
                          # Floatに変換してから四捨五入で整数に
                          # 例: "12.5" -> 12.5 -> 13, "15" -> 15.0 -> 15
                          Float(value).round
                        end
      rescue ArgumentError, FloatDomainError, RangeError, TypeError => e
        Rails.logger.error("スコア変換エラー: #{key}=#{value.inspect} - #{e.class}")
        raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}"
      end
      scores[key] = integer_value
    end
    scores
  end

  # Gemini APIのレスポンスを解析してHash形式に変換する
  #
  # AIから返されたJSONをパースし、スコアとコメントを抽出します。
  # コードブロックで囲まれたJSONも解析可能です。
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [Hash, JudgmentResult] パース結果 {scores: Hash, comment: String} または エラー結果
  def parse_response(response)
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
      # /```json\s*\n(.*?)\n?```/m  -> ```json と ``` の間のテキストを抽出
      #   - ```json\s*\n: ```json とそれに続く空白・改行にマッチ
      #   - (.*?): 非貪欲マッチでJSON部分をキャプチャ
      #   - \n?```: 改行（オプション）と ``` にマッチ
      #   - /m: マルチラインモード（. が改行にもマッチ）
      #
      # 例: 'Note: ```json\n{"a":1}\n```\nDone' -> '{"a":1}'
      if text.match?(/```json/)
        extracted = text.slice(/```json\s*\n(.*?)\n?```/m, 1)
        return extracted.strip if extracted
      end

      # ```json がない場合（単に ``` のみの場合）
      # 例: '```\n{"a":1}\n```' -> '{"a":1}'
      extracted = text.slice(/```\s*\n(.*?)\n?```/m, 1)
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

  # Gemini APIキーを返す
  #
  # @return [String] APIキー
  # @raise [ArgumentError] APIキーが設定されていない場合
  def api_key
    # rubocop:disable Style/FetchEnvVar
    key = ENV['GEMINI_API_KEY']
    # rubocop:enable Style/FetchEnvVar
    raise ArgumentError, 'GEMINI_API_KEYが設定されていません' unless key && !key.to_s.strip.empty?

    key
  end

  # Gemini APIにHTTPリクエストを送信する
  #
  # @param request_body [Hash] APIリクエストボディ
  # @return [Faraday::Response] HTTPレスポンス
  def execute_request(request_body)
    endpoint = "#{API_VERSION}/models/#{MODEL_NAME}:generateContent"

    response = client.post(endpoint) do |req|
      req.params[:key] = api_key
      req.headers['Content-Type'] = 'application/json'
      req.body = JSON.generate(request_body)
    end

    case response.status
    when 200..299
      Rails.logger.info('Gemini API呼び出し成功')
      response
    when 429
      Rails.logger.warn("Gemini APIレート制限: #{response.body}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    when 400..499
      Rails.logger.error("Gemini APIクライアントエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Client error: #{response.status}", faraday_response: response)
    when 500..599
      Rails.logger.error("Gemini APIサーバーエラー: #{response.status} - #{response.body}")
      raise Faraday::ServerError.new("Server error: #{response.status}", faraday_response: response)
    else
      Rails.logger.error("Gemini API未知のエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("Unknown error: #{response.status}", faraday_response: response)
    end
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("Gemini APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("Gemini API接続エラー: #{e.class}")
    raise
  end
end
