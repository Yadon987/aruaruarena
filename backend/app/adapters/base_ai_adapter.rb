# frozen_string_literal: true

# BaseAiAdapter - AIサービスアダプターの基底クラス
# Template MethodパターンでAIサービス共通処理を実装
class BaseAiAdapter
  MAX_RETRIES = 3
  BASE_TIMEOUT = 30
  RETRY_DELAY = 1.0
  VALID_PERSONAS = %w[hiroyuki dewi nakao].freeze

  # 審査結果の構造体
  JudgmentResult = Struct.new(:succeeded, :error_code, :scores, :comment, keyword_init: true)

  # 投稿を審査して結果を返す
  # @param post_content [String] 投稿本文（3-30文字、grapheme単位）
  # @param persona [String] 審査員ID（hiroyuki/dewi/nakao）
  # @return [JudgmentResult] 審査結果
  def judge(post_content, persona:)
    validate_inputs!(post_content, persona)
    with_retry(post_content, persona)
  end

  private

  # 入力バリデーション
  def validate_inputs!(post_content, persona)
    # post_contentの検証
    if post_content.nil? || post_content.to_s.strip.empty?
      raise ArgumentError, 'post_contentは必須です'
    end

    # 制御文字のチェック
    if post_content.match?(/[\x00-\x1F\x7F]/)
      raise ArgumentError, 'post_contentに制御文字は含められません'
    end

    # grapheme単位の文字数チェック
    grapheme_count = post_content.scan(/\X/).length
    if grapheme_count < 3 || grapheme_count > 30
      raise ArgumentError, 'post_contentは3-30文字である必要があります'
    end

    # personaの検証
    if persona.nil? || persona.to_s.strip.empty?
      raise ArgumentError, 'personaは必須です'
    end

    unless VALID_PERSONAS.include?(persona)
      raise ArgumentError, "不正なpersonaです: #{persona}"
    end
  end

  # リトライ処理付きでAI APIを呼び出す
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
        retry_sleep(RETRY_DELAY * (2 ** (retries - 1)))
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
  def call_ai_api(post_content, persona)
    request = build_request(post_content, persona)
    response = parse_response(request)

    # レスポンスの検証
    return response if response.is_a?(JudgmentResult)

    # スコア範囲チェック
    scores = response['scores'] || response[:scores]
    if scores && scores.values.any? { |v| v.to_i < 0 || v.to_i > 20 }
      return JudgmentResult.new(succeeded: false, error_code: 'invalid_response', scores: nil, comment: nil)
    end

    # コメントチェック
    comment = response['comment'] || response[:comment]
    if comment.nil? || comment.to_s.empty?
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

  # ペルソナバイアスを適用
  def apply_persona_bias!(result, persona)
    return result unless result.succeeded

    biased_scores = Judgment.apply_persona_bias(result.scores.dup, persona)
    JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: biased_scores,
      comment: result.comment
    )
  end

  # リトライ時のsleep（テスト用に分離）
  def retry_sleep(duration)
    sleep(duration)
  end

  # 例外をエラーコードにマッピング
  def handle_error(error)
    code = case error
            when Timeout::Error, Faraday::TimeoutError then 'timeout'
            when Faraday::ConnectionFailed then 'connection_failed'
            when Faraday::ClientError, Faraday::ServerError then 'provider_error'
            when JSON::ParserError then 'invalid_response'
            else 'unknown_error'
            end

    JudgmentResult.new(succeeded: false, error_code: code, scores: nil, comment: nil)
  end

  # 抽象メソッド（サブクラスで実装）
  def client
    raise NotImplementedError, 'must be implemented'
  end

  def build_request(post_content, persona)
    raise NotImplementedError, 'must be implemented'
  end

  def parse_response(response)
    raise NotImplementedError, 'must be implemented'
  end

  def api_key
    raise NotImplementedError, 'must be implemented'
  end
end
