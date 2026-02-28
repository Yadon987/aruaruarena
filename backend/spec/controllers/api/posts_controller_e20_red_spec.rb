# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::PostsController, type: :controller do
  describe 'GET #show' do
    # 何を検証するか: judging状態の投稿に対してクローラーが来たときは404を返すこと
    it 'judging状態の投稿でクローラーとしてアクセスした場合、404が返ること' do
      post = instance_double(Post, id: 'judging-id', status: Post::STATUS_JUDGING)

      request.headers['User-Agent'] = 'Twitterbot/1.0'
      allow(Post).to receive(:find).with('judging-id').and_return(post)

      get :show, params: { id: 'judging-id' }

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body).to include('error' => '投稿が見つかりません', 'code' => 'NOT_FOUND')
    end

    # 何を検証するか: failed状態の投稿に対してクローラーが来たときは404を返すこと
    it 'failed状態の投稿でクローラーとしてアクセスした場合、404が返ること' do
      post = instance_double(Post, id: 'failed-id', status: Post::STATUS_FAILED)

      request.headers['User-Agent'] = 'Twitterbot/1.0'
      allow(Post).to receive(:find).with('failed-id').and_return(post)

      get :show, params: { id: 'failed-id' }

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body).to include('error' => '投稿が見つかりません', 'code' => 'NOT_FOUND')
    end
  end
end
