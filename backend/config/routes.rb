Rails.application.routes.draw do
  # API routes
  namespace :api do
    # Health check endpoint
    get :health, to: 'health#check'
  end
end
