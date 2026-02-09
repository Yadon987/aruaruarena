# frozen_string_literal: true

module Api
  # APIヘルスチェック用コントローラー
  class HealthCheckController < ApplicationController
    def index
      render json: { status: 'Running!', env: Rails.env }
    end
  end
end
