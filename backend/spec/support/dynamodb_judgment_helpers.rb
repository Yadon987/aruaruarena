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

  # DynamoDBから投稿IDとペルソナでJudgmentを1件取得する共通メソッド
  #
  # @param post_id [String] 投稿ID
  # @param persona [String] ペルソナID
  # @return [Judgment, nil] 該当するJudgment、存在しない場合はnil
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

  # DynamoDBから投稿IDに紐づくJudgmentを全件取得する共通メソッド
  #
  # @param post_id [String] 投稿ID
  # @return [Array<Judgment>] 該当するJudgment一覧
  def query_judgments_by_post_id(post_id)
    client = Dynamoid.adapter.client
    items = []
    last_evaluated_key = nil

    loop do
      response = query_judgment_page(client, post_id, last_evaluated_key)
      items.concat(response.items)
      last_evaluated_key = response.last_evaluated_key
      break if last_evaluated_key.nil?
    end

    items.map { |item| build_judgment_from_item(item) }
  end

  def query_judgment_page(client, post_id, last_evaluated_key)
    client.query(
      table_name: Judgment.table_name,
      key_condition_expression: 'post_id = :post_id',
      expression_attribute_values: {
        ':post_id' => post_id
      },
      exclusive_start_key: last_evaluated_key
    )
  end
end
