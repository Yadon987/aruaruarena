# frozen_string_literal: true

module DynamoDBTestHelpers
  # DynamoDB Localの整合性問題を回避するため、AWS SDKを直接使用するヘルパー
  # Dynamoidのwhere/findが複合キーで正しく動作しないため

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

    # Judgmentオブジェクトを構築
    Judgment.new(
      post_id: response.item['post_id'],
      persona: response.item['persona'],
      id: response.item['id'],
      succeeded: response.item['succeeded'],
      error_code: response.item['error_code'],
      judged_at: response.item['judged_at'],
      empathy: response.item['empathy'],
      humor: response.item['humor'],
      brevity: response.item['brevity'],
      originality: response.item['originality'],
      expression: response.item['expression'],
      total_score: response.item['total_score'],
      comment: response.item['comment']
    )
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

    response.items.map do |item|
      Judgment.new(
        post_id: item['post_id'],
        persona: item['persona'],
        id: item['id'],
        succeeded: item['succeeded'],
        error_code: item['error_code'],
        judged_at: item['judged_at'],
        empathy: item['empathy'],
        humor: item['humor'],
        brevity: item['brevity'],
        originality: item['originality'],
        expression: item['expression'],
        total_score: item['total_score'],
        comment: item['comment']
      )
    end
  end

  # テーブル内の全アイテムを削除（テスト前処理用）
  def cleanup_judgments_table
    Judgment.delete_all
    # 削除が完了するまで待機（ポーリング）
    Timeout.timeout(10) do
      sleep(0.1) until Judgment.count.zero? # rubocop:disable Style/CollectionQuerying
    end
  end
end
