# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Posts', type: :request do
  # コントローラー未実装のためPending
  describe 'Blog Draft Feature API', skip: 'Not implemented yet' do
    let(:user_id) { SecureRandom.uuid }
    let(:headers) { { 'X-User-ID' => user_id } } # 認証ヘッダーの想定

    describe 'POST /posts (Draft)' do
      it 'published_atを指定せずに作成すると下書きになること' do
        post_params = {
          post: {
            nickname: 'Test User',
            body: 'Draft body content'
          }
        }

        post '/posts', params: post_params, headers: headers
        expect(response).to have_http_status(:created)

        json = response.parsed_body
        expect(json['published_at']).to be_nil
        expect(json['user_id']).to eq(user_id)
      end
    end

    describe 'PUT /posts/:id/publish' do
      let!(:draft_post) { create(:post, :draft, user_id: user_id) }

      it '下書きを公開できること' do
        put "/posts/#{draft_post.id}/publish", headers: headers
        expect(response).to have_http_status(:ok)

        draft_post.reload
        expect(draft_post.published?).to be true
      end
    end

    describe 'PUT /posts/:id/unpublish' do
      let!(:published_post) { create(:post, :published, user_id: user_id) }

      it '公開記事を下書きに戻せること' do
        put "/posts/#{published_post.id}/unpublish", headers: headers
        expect(response).to have_http_status(:ok)

        published_post.reload
        expect(published_post.draft?).to be true
      end
    end

    describe 'GET /posts' do
      let!(:draft_post) { create(:post, :draft) }
      let!(:published_post) { create(:post, :published) }

      it '公開記事のみ取得できること' do
        get '/posts'
        expect(response).to have_http_status(:ok)

        json = response.parsed_body
        ids = json.pluck('id')
        expect(ids).to include(published_post.id)
        expect(ids).not_to include(draft_post.id)
      end
    end

    describe 'GET /posts/drafts' do
      let!(:my_draft) { create(:post, :draft, user_id: user_id) }
      let!(:other_draft) { create(:post, :draft, user_id: 'other-user') }

      it '自分の下書きのみ取得できること' do
        get '/posts/drafts', headers: headers
        expect(response).to have_http_status(:ok)

        json = response.parsed_body
        ids = json.pluck('id')
        expect(ids).to include(my_draft.id)
        expect(ids).not_to include(other_draft.id)
      end
    end
  end
end
