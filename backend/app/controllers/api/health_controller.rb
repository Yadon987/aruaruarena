class Api::HealthController < ApplicationController
  def check
    render json: { status: 'ok', environment: Rails.env, timestamp: Time.current }
  end
end
