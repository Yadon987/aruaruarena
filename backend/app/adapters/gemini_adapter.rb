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
  BASE_URL = 'https://generativelanguage.googleapis.com'.freeze

  # Gemini 2.0 Flash Experimentalモデル
  MODEL_NAME = 'gemini-2.0-flash-exp'.freeze

  # APIバージョン
  API_VERSION = 'v1beta'.freeze

  # レスポンスの最大長（コメント用）
  MAX_COMMENT_LENGTH = 30

  # プロンプトのキャッシュ（スレッドセーフ）
  @prompt_cache = nil
  @prompt_mutex = Mutex.new

  class << self
    # キャッシュされたプロンプトを取得する
    #
    # @return [String, nil] キャッシュされたプロンプト
    def prompt_cache
      @prompt_cache
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
    if PROMPT_PATH.include?('..') || PROMPT_PATH.start_with?('/')
      raise ArgumentError, 'プロンプトファイルが見つかりません: パストラバーサル検出'
    end

    unless File.exist?(PROMPT_PATH)
      raise ArgumentError, "プロンプトファイルが見つかりません: #{PROMPT_PATH}"
    end

    prompt = File.read(PROMPT_PATH)
    self.class.prompt_cache = prompt
    prompt
  end

  # Faraday HTTPクライアントを返す
  #
  # SSL証明書検証が有効化されています。
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

  # Gemini API用のリクエストを構築する
  #
  # プロンプト内の{post_content}プレースホルダーを実際の投稿内容で置換します。
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID（現状はhiroyukiのみ対応）
  # @return [Hash] APIリクエストボディ
  def build_request(post_content, persona)
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
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    }
  end

  # Gemini APIのレスポンスを解析してHash形式に変換する
  #
  # AIから返されたJSONをパースし、スコアとコメントを抽出します。
  # コードブロックで囲まれたJSONも解析可能です。
  #
  # @param response [Faraday::Response] APIレスポンス
  # @return [Hash] パース結果 {scores: Hash, comment: String}
  def parse_response(response)
    # Faraday::Responseからボディを取得
    body = response.body
    parsed = JSON.parse(body, symbolize_names: true)

    # candidatesのチェック
    candidates = parsed[:candidates]
    unless candidates&.first&.dig(:content, :parts)&.first&.dig(:text)
      Rails.logger.error('Gemini APIレスポンスにcandidatesが含まれていません')
      return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
    end

    text = candidates.first[:content][:parts].first[:text]

    # コードブロックを除去
    json_text = extract_json_from_codeblock(text)

    # JSONをパース
    data = JSON.parse(json_text, symbolize_names: true)

    # スコアを整数に変換
    scores = {}
    REQUIRED_SCORE_KEYS.each do |key|
      value = data[key]
      # 文字列や浮動小数点数を整数に変換
      scores[key] = value.is_a?(Integer) ? value : Integer(value)
    end

    # コメントを切り詰め
    comment = truncate_comment(data[:comment])

    {
      scores: scores,
      comment: comment
    }
  rescue JSON::ParserError, NoMethodError, ArgumentError, TypeError => e
    Rails.logger.error("JSONパースエラー: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n")) if Rails.env.development?
    JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
  end

  # コードブロックからJSONを抽出する
  #
  # markdownのコードブロック（```json ... ```）を除去します。
  #
  # @param text [String] 生のテキスト
  # @return [String] 抽出されたJSON文字列
  def extract_json_from_codeblock(text)
    # コードブロックを除去
    if text.include?('```')
      # ```json と ``` の間のテキストを抽出
      text.gsub(/```json\s*/, '').gsub(/```\s*/, '').strip
    else
      text
    end
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
    key = ENV['GEMINI_API_KEY']
    unless key && !key.to_s.strip.empty?
      raise ArgumentError, 'GEMINI_API_KEYが設定されていません'
    end
    key
  end

  # 親クラスのcall_ai_apiをオーバーライドしてHTTP通信を実装
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [JudgmentResult] 審査結果
  def call_ai_api(post_content, persona)
    request_body = build_request(post_content, persona)
    endpoint = "#{API_VERSION}/models/#{MODEL_NAME}:generateContent"

    response = client.post(endpoint) do |req|
      req.params[:key] = api_key
      req.headers['Content-Type'] = 'application/json'
      req.body = JSON.generate(request_body)
    end

    case response.status
    when 200
      Rails.logger.info('Gemini API呼び出し成功')
      # parse_responseはHashまたはJudgmentResultを返す
      parse_result = parse_response(response)

      # JudgmentResultが返された場合はそのまま返す（エラー時）
      return parse_result if parse_result.is_a?(JudgmentResult)

      # Hashが返された場合は親クラスのバリデーションを実行
      scores = parse_result[:scores] || parse_result['scores']
      comment = parse_result[:comment] || parse_result['comment']

      # 必須キーの完全性チェック
      if scores && !valid_score_keys?(scores)
        return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
      end

      # スコア範囲チェック
      if scores && !scores_within_range?(scores)
        return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
      end

      # コメントチェック
      unless valid_comment?(comment)
        return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
      end

      JudgmentResult.new(
        succeeded: true,
        error_code: nil,
        scores: scores.transform_keys(&:to_sym),
        comment: comment
      )
    when 429
      Rails.logger.warn("Gemini APIレート制限: #{response.body}")
      raise Faraday::ClientError.new('rate limit', faraday_response: response)
    else
      Rails.logger.error("Gemini APIエラー: #{response.status} - #{response.body}")
      raise Faraday::ClientError.new("API error: #{response.status}", faraday_response: response)
    end
  rescue Faraday::TimeoutError => e
    Rails.logger.warn("Gemini APIタイムアウト: #{e.class}")
    raise
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("Gemini API接続エラー: #{e.class}")
    raise
  end
end
