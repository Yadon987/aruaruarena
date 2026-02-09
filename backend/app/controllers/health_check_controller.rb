# frozen_string_literal: true

class HealthCheckController < ApplicationController
  def index
    render json: { status: 'Running!', env: Rails.env }
  end
end
