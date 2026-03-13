# frozen_string_literal: true

module DynamoDBJudgmentHelpers
  JUDGMENT_ATTRIBUTE_KEYS = %w[
    post_id persona id succeeded error_code judged_at empathy humor brevity
    originality expression total_score comment
  ].freeze

  # DynamoDB項目からJudgmentオブジェクトを構築する共通メソッド
  #
  # @param item [Hash] DynamoDBから取得した項目
  # @return [Judgment] 構築されたJudgmentオブジェクト
  def build_judgment_from_item(item)
    Judgment.new(item.slice(*JUDGMENT_ATTRIBUTE_KEYS).symbolize_keys)
  end

  def find_judgment_by_aws(post_id, persona)
    client = Dynamoid.adapter.client
    response = client.get_item(
      table_name: Judgment.table_name,
      key: {
        post_id: post_id,
        persona: persona
      }
    )
    return nil if response.item.nil?

    build_judgment_from_item(response.item)
  end

  def query_judgments_by_post_id(post_id)
    client = Dynamoid.adapter.client
    response = client.query(
      table_name: Judgment.table_name,
      key_condition_expression: 'post_id = :post_id',
      expression_attribute_values: {
        ':post_id' => post_id
      }
    )

    response.items.map { |item| build_judgment_from_item(item) }
  end
end
