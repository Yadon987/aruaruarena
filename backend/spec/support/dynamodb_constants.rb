# frozen_string_literal: true

module DynamoDBConstants
  TEST_ENDPOINT = 'http://127.0.0.1:8002'

  def self.normalized_endpoint(endpoint)
    return TEST_ENDPOINT if endpoint.to_s.empty?

    endpoint
  end
end
