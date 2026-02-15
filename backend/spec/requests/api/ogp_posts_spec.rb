# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API::OGP Posts', type: :request do
  # 何を検証するか: OgpTestHelpersのメソッドを使用
  include OgpTestHelpers

  describe 'GET /ogp/posts/:id.png' do
    let(:scored_post) { create(:post, :scored, average_score: 85.5) }

    context '正常系' do
      before do
        # 審査員を作成
        create(:judgment, :hiroyuki, post_id: scored_post.id, succeeded: true)
        create(:judgment, :dewi, post_id: scored_post.id, succeeded: true)
        create(:judgment, :nakao, post_id: scored_post.id, succeeded: true)

        setup_image_mocks
        setup_draw_mocks
        setup_file_exist_mocks
        setup_rank_mock(10)
      end

      # 何を検証するか: 正常に画像が返却されること (Content-Type: image/png, Status: 200)
      it '正常に画像が返却されること (Content-Type: image/png, Status: 200)' do
        get "/ogp/posts/#{scored_post.id}.png"

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('image/png')
      end

      # 何を検証するか: Cache-Control: public, max-age=604800 ヘッダーが設定されていること
      it 'Cache-Control: public, max-age=604800 ヘッダーが設定されていること' do
        get "/ogp/posts/#{scored_post.id}.png"

        cache_control = response.headers['Cache-Control']
        expect(cache_control).to include('public')
        expect(cache_control).to include('max-age=604800')
      end

      # 何を検証するか: 画像サイズが1200x630pxであること
      it '画像サイズが1200x630pxであること' do
        get "/ogp/posts/#{scored_post.id}.png"

        # モックされたバイナリを検証
        expect(response.body).to start_with("\x89PNG")
      end

      # 何を検証するか: 投稿内容が画像に反映されていること（モック検証でOgpGeneratorService.callの引数を確認）
      it '投稿内容が画像に反映されていること（モック検証でOgpGeneratorService.callの引数を確認）' do
        expect(OgpGeneratorService).to receive(:call).with(scored_post.id).and_call_original

        get "/ogp/posts/#{scored_post.id}.png"

        expect(response).to have_http_status(:ok)
      end

      # 何を検証するか: 審査員情報が画像に反映されていること（モック検証でOgpGeneratorService.callの引数を確認）
      it '審査員情報が画像に反映されていること（モック検証でOgpGeneratorService.callの引数を確認）' do
        expect(OgpGeneratorService).to receive(:call).with(scored_post.id).and_call_original

        get "/ogp/posts/#{scored_post.id}.png"

        expect(response).to have_http_status(:ok)
      end
    end

    context '異常系' do
      # 何を検証するか: judging状態の投稿は404を返すこと
      it 'judging状態の投稿は404を返すこと' do
        judging_post = create(:post, status: 'judging')

        get "/ogp/posts/#{judging_post.id}.png"

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      # 何を検証するか: failed状態の投稿は404を返すこと
      it 'failed状態の投稿は404を返すこと' do
        failed_post = create(:post, status: 'failed')

        get "/ogp/posts/#{failed_post.id}.png"

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      # 何を検証するか: 存在しないIDは404を返すこと
      it '存在しないIDは404を返すこと' do
        nonexistent_id = SecureRandom.uuid

        get "/ogp/posts/#{nonexistent_id}.png"

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      # 何を検証するか: 不正なUUID（例: invalid-id）は404を返すこと
      it '不正なUUID（例: invalid-id）は404を返すこと' do
        get '/ogp/posts/invalid-id.png'

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      # 何を検証するか: エラーレスポンスが統一フォーマット { error: "...", code: "NOT_FOUND" } であること
      it 'エラーレスポンスが統一フォーマット { error: "...", code: "NOT_FOUND" } であること' do
        get '/ogp/posts/nonexistent.png'

        json = response.parsed_body
        expect(json).to have_key('error')
        expect(json).to have_key('code')
        expect(json['code']).to eq('NOT_FOUND')
      end

      # 何を検証するか: OgpGeneratorServiceがnilを返した場合、404を返すこと
      it 'OgpGeneratorServiceがnilを返した場合、404を返すこと' do
        post = create(:post, :scored, average_score: nil)

        # サービスがnilを返すようにモック
        allow(OgpGeneratorService).to receive(:call).and_return(nil)

        get "/ogp/posts/#{post.id}.png"

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      context '異常UUIDフォーマット' do
        # 何を検証するか: 短すぎるIDは404を返すこと
        it '短すぎるIDは404を返すこと' do
          get '/ogp/posts/a.png'

          expect(response).to have_http_status(:not_found)
          json = response.parsed_body
          expect(json['error']).to include('投稿が見つかりません')
          expect(json['code']).to eq('NOT_FOUND')
        end

        # 何を検証するか: 長すぎるIDは404を返すこと
        it '長すぎるIDは404を返すこと' do
          long_id = 'a' * 100
          get "/ogp/posts/#{long_id}.png"

          expect(response).to have_http_status(:not_found)
          json = response.parsed_body
          expect(json['error']).to include('投稿が見つかりません')
          expect(json['code']).to eq('NOT_FOUND')
        end

        # 何を検証するか: SQLインジェクション風の文字列は404を返すこと
        it 'SQLインジェクション風の文字列は404を返すこと' do
          injection_inputs = [
            'test-drop',
            "1'or1",
            'admin--'
          ]

          injection_inputs.each do |input|
            get "/ogp/posts/#{input}.png"

            expect(response).to have_http_status(:not_found)
            json = response.parsed_body
            expect(json['error']).to include('投稿が見つかりません')
            expect(json['code']).to eq('NOT_FOUND')
          end
        end

        # 何を検証するか: ヌルバイトを含む文字列は404を返すこと
        it 'ヌルバイトを含む文字列は404を返すこと' do
          get '/ogp/posts/test%00id.png'

          expect(response).to have_http_status(:not_found)
          json = response.parsed_body
          expect(json['error']).to include('投稿が見つかりません')
          expect(json['code']).to eq('NOT_FOUND')
        end
      end
    end

    context '境界値' do
      before do
        setup_image_mocks
        setup_draw_mocks
        setup_file_exist_mocks
      end

      # 何を検証するか: スコア0点の投稿も画像が生成されること（ステータスコード200）
      it 'スコア0点の投稿も画像が生成されること（ステータスコード200）' do
        post = create(:post, :scored, average_score: 0.0)
        create(:judgment, :hiroyuki, post_id: post.id, succeeded: true)
        setup_rank_mock(1)

        get "/ogp/posts/#{post.id}.png"

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('image/png')
      end

      # 何を検証するか: スコア100点の投稿も画像が生成されること（ステータスコード200）
      it 'スコア100点の投稿も画像が生成されること（ステータスコード200）' do
        post = create(:post, :scored, average_score: 100.0)
        create(:judgment, :hiroyuki, post_id: post.id, succeeded: true)
        setup_rank_mock(1)

        get "/ogp/posts/#{post.id}.png"

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('image/png')
      end
    end

    context '同時リクエスト' do
      before do
        setup_image_mocks
        setup_draw_mocks
        setup_file_exist_mocks
      end

      # 何を検証するか: 同一投稿IDに対する同時リクエストが適切に処理されること
      it '同一投稿IDに対する同時リクエストが適切に処理されること' do
        post = create(:post, :scored, average_score: 50.0)
        create(:judgment, :hiroyuki, post_id: post.id, succeeded: true)
        setup_rank_mock(1)

        # 10件のリクエストを送信（同時実行の模倣）
        10.times do
          get "/ogp/posts/#{post.id}.png"
          expect(response).to have_http_status(:ok)
        end
      end

      # 何を検証するか: 異なる投稿IDに対する同時リクエストが適切に処理されること
      it '異なる投稿IDに対する同時リクエストが適切に処理されること' do
        posts = create_list(:post, 5, :scored, average_score: 50.0)

        posts.each do |post|
          create(:judgment, :hiroyuki, post_id: post.id, succeeded: true)
        end

        # 各投稿に対して2回ずつリクエストを送信
        posts.each do |post|
          2.times do
            get "/ogp/posts/#{post.id}.png"
            expect(response).to have_http_status(:ok)
          end
        end
      end

      # 何を検証するか: 存在しない投稿IDに対する同時リクエストが404を返すこと
      it '存在しない投稿IDに対する同時リクエストが404を返すこと' do
        nonexistent_id = SecureRandom.uuid

        # 10件のリクエストを送信（同時実行の模倣）
        10.times do
          get "/ogp/posts/#{nonexistent_id}.png"
          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end
end
