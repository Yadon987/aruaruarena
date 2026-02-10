# frozen_string_literal: true

# テスト用モッククラス
# BaseAiAdapterの抽象メソッドを実装し、テスト用の振る舞いを提供する
class TestAdapter < BaseAiAdapter
  attr_accessor :mock_client, :mock_response, :mock_response_proc

  def initialize
    @call_count = 0
    @mutex = Mutex.new
  end

  def client
    @mock_client ||= nil
  end

  def build_request(post_content, persona)
    {
      content: post_content,
      persona: persona,
      timestamp: Time.now.to_i
    }
  end

  def parse_response(response)
    @mutex.synchronize do
      @call_count += 1
    end

    # プロックが設定されている場合はそれを使用（リトライテスト用）
    if @mock_response_proc
      result = @mock_response_proc.call(@call_count)
      return result if result.is_a?(BaseAiAdapter::JudgmentResult)
      # スコア範囲チェック
      return create_error_result('invalid_response') if invalid_scores?(result)
      return create_error_result('invalid_response') if empty_comment?(result)
      return result
    end

    # 通常のモックレスポンス
    return @mock_response if @mock_response

    # デフォルトの成功レスポンス
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

  def api_key
    'test_api_key_for_testing'
  end

  def reset_call_count!
    @mutex.synchronize do
      @call_count = 0
    end
  end

  def call_count
    @mutex.synchronize do
      @call_count
    end
  end

  private

  def create_error_result(error_code)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: error_code,
      scores: nil,
      comment: nil
    )
  end

  def invalid_scores?(response)
    scores = response.dig('scores') || response.dig(:scores)
    return true unless scores

    scores.values.any? { |v| v.to_i < 0 || v.to_i > 20 }
  end

  def empty_comment?(response)
    comment = response.dig('comment') || response.dig(:comment)
    comment.nil? || comment.to_s.empty?
  end
end
