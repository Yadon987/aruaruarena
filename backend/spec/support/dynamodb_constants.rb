# frozen_string_literal: true

module DynamoDBConstants
  LEGACY_ENDPOINTS = ['http://127.0.0.1:8000', 'http://localhost:8000'].freeze
  TEST_ENDPOINT = 'http://127.0.0.1:8002'

  def self.normalized_endpoint(endpoint)
    return TEST_ENDPOINT if endpoint.to_s.empty?
    return TEST_ENDPOINT if LEGACY_ENDPOINTS.include?(endpoint)

    endpoint
  end
end
