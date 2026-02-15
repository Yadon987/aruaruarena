# frozen_string_literal: true

Rails.application.routes.draw do
  # ヘルスチェックエンドポイント（AWS/ロードバランサー用）
  get 'health', to: 'health_check#index'

  # API routes
  namespace :api do
    # ヘルスチェックエンドポイント（クライアント/フロントエンド用）
    get :health, to: 'health_check#index'
    resources :posts, only: %i[create show]
    resources :rankings, only: %i[index] # E08 追加
  end

  # OGP画像用ルート
  # format: false を使用して、.pngをparams[:id]に含める
  get '/ogp/posts/:id.png', to: 'ogp#show', format: false
end
