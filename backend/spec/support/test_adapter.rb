# frozen_string_literal: true

# テスト用モッククラス
#
# BaseAiAdapterの抽象メソッドを実装し、テスト用の振る舞いを提供します。
# mock_response_procを使用することで、リトライテスト等の動的なレスポンスをシミュレートできます。
#
# @note このクラスはスレッドセーフです（call_countのアクセスにMutexを使用）
class TestAdapter < BaseAiAdapter
  attr_accessor :mock_client, :mock_response, :mock_response_proc

  # テスト用アダプターを初期化する
  def initialize
    @call_count = 0
    @mutex = Mutex.new
  end

  # HTTPクライアントのモック
  # @return [nil] テスト用のためnilを返す
  def client
    @mock_client ||= nil
  end

  # テスト用リクエスト構築
  #
  # @param post_content [String] 投稿本文
  # @param persona [String] 審査員ID
  # @return [Hash] テスト用リクエストハッシュ
  def build_request(post_content, persona)
    {
      content: post_content,
      persona: persona,
      timestamp: Time.now.to_i
    }
  end

  # テスト用レスポンス解析
  #
  # mock_response_procが設定されている場合はそれを使用し、
  # そうでない場合はmock_responseを返します。
  #
  # @param response [Hash] リクエストハッシュ（使用しない）
  # @return [JudgmentResult, Hash] テスト用レスポンス
  def parse_response(response)
    @mutex.synchronize do
      @call_count += 1
    end

    # プロックが設定されている場合はそれを使用（リトライテスト用）
    if @mock_response_proc
      result = @mock_response_proc.call(@call_count)
      return result if result.is_a?(BaseAiAdapter::JudgmentResult)
      return create_error_result('invalid_response') if invalid_scores?(result)
      return create_error_result('invalid_response') if empty_comment?(result)
      return result
    end

    # 通常のモックレスポンス
    return @mock_response if @mock_response

    # デフォルトの成功レスポンス
    default_success_response
  end

  # テスト用APIキー
  # @return [String] テスト用APIキー
  def api_key
    'test_api_key_for_testing'
  end

  # 呼び出し回数をリセット
  def reset_call_count!
    @mutex.synchronize do
      @call_count = 0
    end
  end

  # 呼び出し回数を取得
  # @return [Integer] 呼び出し回数
  def call_count
    @mutex.synchronize do
      @call_count
    end
  end

  private

  # デフォルトの成功レスポンスを作成
  # @return [JudgmentResult] デフォルトの成功レスポンス
  def default_success_response
    BaseAiAdapter::JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: {
        empathy: 15,
        humor: 15,
        brevity: 15,
        originality: 15,
        expression: 15
      },
      comment: 'テストコメント'
    )
  end

  # エラーレスポンスを作成
  #
  # @param error_code [String] エラーコード
  # @return [JudgmentResult] エラーレスポンス
  def create_error_result(error_code)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: error_code,
      scores: nil,
      comment: nil
    )
  end

  # スコアが無効範囲かチェック
  #
  # @param response [Hash] レスポンスハッシュ
  # @return [Boolean] 無効範囲の場合はtrue
  def invalid_scores?(response)
    scores = response.dig('scores') || response.dig(:scores)
    return false unless scores # nilと空ハッシュは有効として扱う

    scores.values.any? { |v| !valid_score_value?(v) }
  end

  # スコア値が有効かチェック
  #
  # @param value [Object] スコア値
  # @return [Boolean] 有効な場合はtrue
  def valid_score_value?(value)
    return false unless value.is_a?(Integer)
    value >= 0 && value <= 20
  end

  # コメントが空かチェック
  #
  # @param response [Hash] レスポンスハッシュ
  # @return [Boolean] 空の場合はtrue
  def empty_comment?(response)
    comment = response.dig('comment') || response.dig(:comment)
    comment.nil? || comment.to_s.strip.empty?
  end
end
