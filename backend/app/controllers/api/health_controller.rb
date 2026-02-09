# frozen_string_literal: true

module Api
  class HealthController < ApplicationController
    def check
      render json: { status: 'ok', environment: Rails.env, timestamp: Time.current }
    end
  end
end
