# frozen_string_literal: true

# Postのclaim属性読み書きを担当するサービス
class PostClaimService
  class << self
    # @param post [Post]
    # @return [Integer, String, nil]
    def current_claimed_at(post)
      item = Dynamoid.adapter.client.get_item(
        table_name: Post.table_name,
        key: { id: post.id }
      ).item
      item&.[](Post::CLAIM_FIELD)
    end

    # @param post [Post]
    # @param claimed_at [Integer, String, nil]
    # @return [nil]
    def clear_claim_field!(post, claimed_at)
      return if claimed_at.nil?

      Dynamoid.adapter.client.update_item(
        table_name: Post.table_name,
        key: { id: post.id },
        update_expression: 'REMOVE #claim',
        condition_expression: '#status <> :judging AND #claim = :claimed_at',
        expression_attribute_names: {
          '#status' => 'status',
          '#claim' => Post::CLAIM_FIELD
        },
        expression_attribute_values: {
          ':judging' => Post::STATUS_JUDGING,
          ':claimed_at' => claimed_at
        }
      )
    rescue Aws::DynamoDB::Errors::ConditionalCheckFailedException
      nil
    end
  end
end
