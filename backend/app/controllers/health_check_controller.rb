# frozen_string_literal: true

# ヘルスチェック用コントローラー
class HealthCheckController < ApplicationController
  include HealthCheckable

  def index
    response = health_check_response
    render json: response[:payload], status: response[:http_status]
  end
end
