# frozen_string_literal: true

# BaseAiAdapter - AIサービスアダプターの基底クラス
#
# Template Methodパターンを使用して、AIサービス共通処理を実装します。
# サブクラスはclient, build_request, parse_response, api_keyメソッドを実装する必要があります。
#
# @example サブクラスの実装
#   class GeminiAdapter < BaseAiAdapter
#     private
#
#     def client
#       @client ||= Faraday.new(url: 'https://generativelanguage.googleapis.com') do |f|
#         f.request :url_encoded
#         f.adapter Faraday.default_adapter
#       end
#     end
#
#     def build_request(post_content, persona)
#       # Gemini API用のリクエスト構築
#     end
#
#     def parse_response(response)
#       # Gemini APIレスポンスのパース
#     end
#
#     def api_key
#       ENV['GEMINI_API_KEY']
#     end
#   end
class BaseAiAdapter
  # 最大リトライ回数
  MAX_RETRIES = 2

  # APIタイムアウト時間（秒）
  BASE_TIMEOUT = 20

  # リトライ時の基本遅延時間（秒）
  # 指数バックオフで1秒→2秒と増加
  RETRY_DELAY = 1.0

  # 有効なペルソナID
  VALID_PERSONAS = %w[hiroyuki dewi nakao].freeze

  # 投稿本文の最小文字数（grapheme単位）
  MIN_CONTENT_LENGTH = 3

  # 投稿本文の最大文字数（grapheme単位）
  MAX_CONTENT_LENGTH = 30

  # スコアの最小値
  MIN_SCORE_VALUE = 0

  # スコアの最大値
  MAX_SCORE_VALUE = 20

  # 必須のスコアキー
  REQUIRED_SCORE_KEYS = %i[empathy humor brevity originality expression].freeze

  # 制御文字の正規表現パターン
  # Note: grapheme長制限があるため、ReDoSリスクは低い
  CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/

  # Graphemeクラスタ（絵文字等）の正規表現パターン
  # Note: grapheme長制限があるため、ReDoSリスクは低い
  GRAPHEME_CLUSTER_PATTERN = /\X/

  # 審査結果の構造体
  #
  # @attr [Boolean] succeeded 審査が成功したかどうか
  # @attr [String, nil] error_code エラーコード（失敗時）
  # @attr [Hash, nil] scores 5項目のスコア（成功時）
  # @attr [String, nil] comment AI審査員のコメント（成功時）
  JudgmentResult = Struct.new(:succeeded, :error_code, :scores, :comment, keyword_init: true)

  # 投稿を審査して結果を返す
  #
  # @param post_content [String] 投稿本文（3-30文字、grapheme単位）
  # @param persona [String] 審査員ID（hiroyuki/dewi/nakao）
  # @return [JudgmentResult] 審査結果
  #
  # @raise [ArgumentError] post_contentまたはpersonaが無効な場合
  #
  # @note このメソッドはスレッドセーフです
  def judge(post_content, persona:)
    validate_inputs!(post_content, persona)
    with_retry(post_content, persona)
  end

  private

  # 入力バリデーションを実行する
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @raise [ArgumentError] バリデーションエラー時
  def validate_inputs!(post_content, persona)
    validate_post_content!(post_content)
    validate_persona!(persona)
  end

  # post_contentのバリデーション
  #
  # @param post_content [String] 投稿本文
  # @raise [ArgumentError] バリデーションエラー時
  def validate_post_content!(post_content)
    raise ArgumentError, 'post_contentは必須です' if post_content.nil? || post_content.to_s.strip.empty?

    raise ArgumentError, 'post_contentに制御文字は含められません' if post_content.match?(CONTROL_CHAR_PATTERN)

    grapheme_count = post_content.scan(GRAPHEME_CLUSTER_PATTERN).length
    return unless grapheme_count < MIN_CONTENT_LENGTH || grapheme_count > MAX_CONTENT_LENGTH

    raise ArgumentError, "post_contentは#{MIN_CONTENT_LENGTH}-#{MAX_CONTENT_LENGTH}文字である必要があります"
  end

  # personaのバリデーション
  #
  # @param persona [String] 審査員ID
  # @raise [ArgumentError] バリデーションエラー時
  def validate_persona!(persona)
    raise ArgumentError, 'personaは必須です' if persona.nil? || persona.to_s.strip.empty?

    return if VALID_PERSONAS.include?(persona)

    raise ArgumentError, "不正なpersonaです: #{persona}"
  end

  # リトライ処理付きでAI APIを呼び出す
  #
  # 指数バックオフアルゴリズムを使用してリトライを実行します。
  # 1回目: 1秒, 2回目: 2秒
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [JudgmentResult] 審査結果
  def with_retry(post_content, persona)
    retries = 0

    begin
      result = call_ai_api(post_content, persona)

      if result.succeeded
        Rails.logger.info("審査成功: persona=#{persona}")
        # ペルソナバイアスを適用
        return apply_persona_bias!(result, persona)
      end

      result
    rescue Timeout::Error, Faraday::TimeoutError, Faraday::ConnectionFailed,
           Faraday::ClientError, Faraday::ServerError, JSON::ParserError => e
      retries += 1

      if retries <= MAX_RETRIES
        Rails.logger.warn("リトライ #{retries}/#{MAX_RETRIES}: #{e.class}")
        retry_sleep(RETRY_DELAY * (2**(retries - 1)))
        retry
      end

      Rails.logger.error("審査失敗: #{e.class}")
      handle_error(e)
    rescue StandardError => e
      Rails.logger.error("審査失敗: #{e.class}")
      handle_error(e)
    end
  end

  # AI APIを呼び出す
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [JudgmentResult] 審査結果
  def call_ai_api(post_content, persona)
    request = build_request(post_content, persona)
    response = execute_request(request)
    parse_result = parse_response(response)

    return parse_result if parse_result.is_a?(JudgmentResult)

    # スコアのバリデーション
    scores = parse_result['scores'] || parse_result[:scores]

    # 必須キーの完全性チェック
    if scores && !valid_score_keys?(scores)
      return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
    end

    # スコア範囲チェック
    if scores && !scores_within_range?(scores)
      return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
    end

    # コメントチェック
    comment = parse_result['comment'] || parse_result[:comment]
    unless valid_comment?(comment)
      return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
    end

    # HashをJudgmentResultに変換
    scores_sym = scores.transform_keys(&:to_sym) if scores
    JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: scores_sym,
      comment: comment
    )
  end

  # スコアが有効範囲内かチェックする
  #
  # @param score [Integer] チェック対象のスコア
  # @return [Boolean] 有効範囲内の場合はtrue
  def valid_score?(score)
    return false unless score.is_a?(Integer)

    score.between?(MIN_SCORE_VALUE, MAX_SCORE_VALUE)
  end

  # 全スコアが有効範囲内かチェックする
  #
  # @param scores [Hash] スコアハッシュ
  # @return [Boolean] 全スコアが有効範囲内の場合はtrue
  def scores_within_range?(scores)
    return true unless scores

    scores.values.all? { |v| valid_score?(v) }
  end

  # スコアキーが完整かチェックする
  #
  # @param scores [Hash] スコアハッシュ
  # @return [Boolean] 必須キーが全て含まれる場合はtrue
  def valid_score_keys?(scores)
    return true unless scores

    scores.keys.map(&:to_sym).sort == REQUIRED_SCORE_KEYS.sort
  end

  # コメントが有効かチェックする
  #
  # @param comment [String, nil] チェック対象のコメント
  # @return [Boolean] コメントが有効な場合はtrue
  def valid_comment?(comment)
    !comment.nil? && !comment.to_s.strip.empty?
  end

  # ペルソナバイアスを適用する
  #
  # @param result [JudgmentResult] 審査結果
  # @param persona [String] 審査員ID
  # @return [JudgmentResult] バイアス適用後の審査結果
  def apply_persona_bias!(result, persona)
    return result unless result.succeeded
    return result if result.scores.blank?

    biased_scores = Judgment.apply_persona_bias(result.scores.dup, persona)
    JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: biased_scores,
      comment: result.comment
    )
  end

  # リトライ時のsleep（テスト用に分離）
  #
  # @param duration [Float] sleep時間（秒）
  def retry_sleep(duration)
    sleep(duration)
  end

  # 例外をエラーコードにマッピングする
  #
  # @param error [Exception] 発生した例外
  # @return [JudgmentResult] 失敗結果
  def handle_error(error)
    code = case error
           when Timeout::Error, Faraday::TimeoutError then 'timeout'
           when Faraday::ConnectionFailed then 'connection_failed'
           when Faraday::ClientError, Faraday::ServerError then 'provider_error'
           when JSON::ParserError then 'invalid_response'
           else 'unknown_error'
           end

    # 詳細なエラーログ（機密情報は含めない）
    Rails.logger.error("審査失敗: #{error.class} - #{error.message}")
    Rails.logger.error(error.backtrace.first(5).join("\n")) if Rails.env.development?

    JudgmentResult.new(succeeded: false, error_code: code, scores: nil, comment: nil)
  end

  # 抽象メソッド（サブクラスで実装）

  # @return [Faraday::Connection] HTTPクライアント
  # @raise [NotImplementedError] サブクラスで実装されていない場合
  def client
    raise NotImplementedError, 'must be implemented'
  end

  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [Hash] APIリクエスト
  # @raise [NotImplementedError] サブクラスで実装されていない場合
  def build_request(post_content, persona)
    raise NotImplementedError, 'must be implemented'
  end

  # @param request [Hash] APIリクエスト
  # @return [Faraday::Response] APIレスポンス
  # @raise [NotImplementedError] サブクラスで実装されていない場合
  def execute_request(request)
    raise NotImplementedError, 'must be implemented'
  end

  # @param response [Hash] APIレスポンス
  # @return [Hash, JudgmentResult] パース結果
  # @raise [NotImplementedError] サブクラスで実装されていない場合
  def parse_response(response)
    raise NotImplementedError, 'must be implemented'
  end

  # @return [String] APIキー
  # @raise [NotImplementedError] サブクラスで実装されていない場合
  def api_key
    raise NotImplementedError, 'must be implemented'
  end
end
