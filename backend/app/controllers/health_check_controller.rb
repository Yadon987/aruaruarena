class HealthCheckController < ApplicationController
  def index
    render json: { status: 'Running!', env: Rails.env }
  end
end
