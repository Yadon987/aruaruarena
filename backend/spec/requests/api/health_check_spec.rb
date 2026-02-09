# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::HealthCheck', type: :request do
  describe 'GET /api/health' do
    it 'ステータスOKを返すこと' do
      get '/api/health'
      expect(response).to have_http_status(:ok)

      json = response.parsed_body
      expect(json['status']).to eq('Running!')
      expect(json['env']).to be_present
    end
  end
end
