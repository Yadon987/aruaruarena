# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PostClaimService, type: :service do
  describe '.current_claimed_at' do
    it 'claim属性を返すこと' do
      post = create(:post)
      claimed_at = Time.current.to_i
      Dynamoid.adapter.client.update_item(
        table_name: Post.table_name,
        key: { id: post.id },
        update_expression: "SET #{Post::CLAIM_FIELD} = :claimed_at",
        expression_attribute_values: { ':claimed_at' => claimed_at }
      )

      expect(described_class.current_claimed_at(post)).to eq(claimed_at)
    end
  end

  describe '.clear_claim_field!' do
    it 'judging以外ならclaim属性を削除すること' do
      post = create(:post, status: Post::STATUS_FAILED)
      claimed_at = Time.current.to_i
      client = Dynamoid.adapter.client
      client.update_item(
        table_name: Post.table_name,
        key: { id: post.id },
        update_expression: "SET #{Post::CLAIM_FIELD} = :claimed_at",
        expression_attribute_values: { ':claimed_at' => claimed_at }
      )

      described_class.clear_claim_field!(post, claimed_at)

      item = client.get_item(table_name: Post.table_name, key: { id: post.id }).item
      expect(item).not_to have_key(Post::CLAIM_FIELD)
    end

    it '条件不一致ならnilを返すこと' do
      post = create(:post, status: Post::STATUS_JUDGING)

      expect(described_class.clear_claim_field!(post, Time.current.to_i)).to be_nil
    end
  end
end
