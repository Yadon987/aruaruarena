# frozen_string_literal: true

Rails.application.routes.draw do
  # Health check endpoint (for AWS/Load Balancer)
  get 'health', to: 'health_check#index'

  # API routes
  namespace :api do
    # Health check endpoint (for Client/Frontend)
    get :health, to: 'health_check#index'
  end
end
