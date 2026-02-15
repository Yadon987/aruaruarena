# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API::Posts Meta Tags', type: :request do
  describe 'GET /api/posts/:id' do
    let(:scored_post) do
      create(:post, :scored,
             nickname: '太郎',
             body: 'スヌーズ押して二度寝',
             average_score: 85.5)
    end

    before do
      # 審査員を作成
      create(:judgment, :hiroyuki, post_id: scored_post.id, succeeded: true)
      create(:judgment, :dewi, post_id: scored_post.id, succeeded: true)
      create(:judgment, :nakao, post_id: scored_post.id, succeeded: true)
    end

    context 'クローラーアクセス' do
      it 'Twitterbotとしてリクエストした場合、OGPタグを含むHTMLが返ること' do
        # 何を検証するか: Twitterbotに対してOGPタグ付きHTMLが返ること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('text/html')
        expect(response.body).to include('<meta property="og:title"')
        expect(response.body).to include('<meta property="og:image"')
        expect(response.body).to include('<meta property="og:description"')
      end

      it 'facebookexternalhitとしてリクエストした場合、OGPタグを含むHTMLが返ること' do
        # 何を検証するか: facebookexternalhitに対してOGPタグ付きHTMLが返ること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'facebookexternalhit/1.1' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('text/html')
        expect(response.body).to include('<meta property="og:title"')
        expect(response.body).to include('<meta property="og:image"')
      end

      it 'line-pokerとしてリクエストした場合、OGPタグを含むHTMLが返ること' do
        # 何を検証するか: line-pokerに対してOGPタグ付きHTMLが返ること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'line-poker/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('text/html')
        expect(response.body).to include('<meta property="og:title"')
      end

      it 'Discordbotとしてリクエストした場合、OGPタグを含むHTMLが返ること' do
        # 何を検証するか: Discordbotに対してOGPタグ付きHTMLが返ること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Discordbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('text/html')
        expect(response.body).to include('<meta property="og:title"')
      end

      it 'Slackbotとしてリクエストした場合、OGPタグを含むHTMLが返ること' do
        # 何を検証するか: Slackbotに対してOGPタグ付きHTMLが返ること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Slackbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('text/html')
        expect(response.body).to include('<meta property="og:title"')
      end

      it 'og:titleに正しいタイトルが含まれること' do
        # 何を検証するか: タイトルが正しく設定されていること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response.body).to include('太郎さんのあるある投稿 | あるあるアリーナ')
      end

      it 'og:descriptionに正しい説明文が含まれること' do
        # 何を検証するか: 説明文が正しく設定されていること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response.body).to include('スヌーズ押して二度寝 (スコア: 85.5点)')
      end

      it 'og:imageに正しい画像パスが含まれること' do
        # 何を検証するか: 画像パスが正しく設定されていること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response.body).to include("/ogp/posts/#{scored_post.id}.png")
      end

      it '完全なHTML構造でレスポンスが返ること' do
        # 何を検証するか: HTML構造が正しいこと
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response.body).to include('<!DOCTYPE html>')
        expect(response.body).to include('<html')
        expect(response.body).to include('</html>')
      end
    end

    context '通常ユーザーアクセス' do
      # rubocop:disable Layout/LineLength
      it '通常のブラウザ（Chrome）でリクエストした場合、JSONが返ること' do
        # 何を検証するか: 通常のブラウザに対してJSONが返ること
        get "/api/posts/#{scored_post.id}",
            headers: { 'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
        expect(response.body).not_to include('<meta property="og:title"')
      end

      it '通常のブラウザ（Safari）でリクエストした場合、JSONが返ること' do
        # 何を検証するか: 通常のブラウザに対してJSONが返ること
        get "/api/posts/#{scored_post.id}",
            headers: { 'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
        expect(response.body).not_to include('<meta property="og:title"')
      end
      # rubocop:enable Layout/LineLength

      it 'User-Agentヘッダーがない場合、JSONが返ること' do
        # 何を検証するか: User-Agentヘッダーがない場合JSONが返ること
        get "/api/posts/#{scored_post.id}"

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
        expect(response.body).not_to include('<meta property="og:title"')
      end

      it 'curlでリクエストした場合、JSONが返ること' do
        # 何を検証するか: curlに対してJSONが返ること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'curl/7.68.0' }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
        expect(response.body).not_to include('<meta property="og:title"')
      end
    end

    context '異常系 (Error Path)' do
      it '存在しない投稿IDでクローラーとしてアクセスした場合、404が返ること' do
        # 何を検証するか: 存在しない投稿IDに対して404エラーが返ること
        nonexistent_id = SecureRandom.uuid
        get "/api/posts/#{nonexistent_id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      it '存在しない投稿IDで通常ユーザーとしてアクセスした場合、404が返ること' do
        # 何を検証するか: 存在しない投稿IDに対して404エラーが返ること
        nonexistent_id = SecureRandom.uuid
        get "/api/posts/#{nonexistent_id}", headers: { 'User-Agent' => 'Mozilla/5.0' }

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      it 'judging状態の投稿でクローラーとしてアクセスした場合、404が返ること' do
        # 何を検証するか: judging状態の投稿に対して404エラーが返ること
        judging_post = create(:post, status: 'judging')
        get "/api/posts/#{judging_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      it 'failed状態の投稿でクローラーとしてアクセスした場合、404が返ること' do
        # 何を検証するか: failed状態の投稿に対して404エラーが返ること
        failed_post = create(:post, status: 'failed')
        get "/api/posts/#{failed_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      it '不正なUUIDでアクセスした場合、404が返ること' do
        # 何を検証するか: 不正なUUIDに対して404エラーが返ること
        get '/api/posts/invalid-id', headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to include('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end
    end

    context '境界値 (Edge Case)' do
      it '説明文が200文字を超える投稿でクローラーとしてアクセスした場合、省略された説明文が返ること' do
        # 何を検証するか: 説明文が200文字を超える場合に省略されること
        long_body = 'あ' * 201
        long_post = create(:post, :scored, nickname: '太郎', body: long_body, average_score: 50.0)
        create(:judgment, :hiroyuki, post_id: long_post.id, succeeded: true)

        get "/api/posts/#{long_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        description_match = response.body.match(/content="([^"]+)"\s+property="og:description"/)
        expect(description_match).not_to be_nil
        description = description_match[1]
        expect(description.length).to be <= 200
        expect(description).to end_with('...')
      end

      it 'スコア0点の投稿でクローラーとしてアクセスした場合、正しく表示されること' do
        # 何を検証するか: 0点でも正しく表示されること
        zero_score_post = create(:post, :scored, nickname: '太郎', body: 'テスト', average_score: 0.0)
        create(:judgment, :hiroyuki, post_id: zero_score_post.id, succeeded: true)

        get "/api/posts/#{zero_score_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.body).to include(' (スコア: 0.0点)')
      end

      it 'スコア100点の投稿でクローラーとしてアクセスした場合、正しく表示されること' do
        # 何を検証するか: 100点でも正しく表示されること
        max_score_post = create(:post, :scored, nickname: '太郎', body: 'テスト', average_score: 100.0)
        create(:judgment, :hiroyuki, post_id: max_score_post.id, succeeded: true)

        get "/api/posts/#{max_score_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.body).to include(' (スコア: 100.0点)')
      end
    end

    context 'フェイルオープン (Resilience)' do
      it 'DynamoDBアクセス失敗時、エラーレスポンスが返ること' do
        # 何を検証するか: DynamoDBエラー時に適切にエラーレスポンスが返ること
        allow(Post).to receive(:find).and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil, 'Service unavailable'))
        allow(Rails.logger).to receive(:error).with(/\[OgpMetaTagService\] DynamoDB error:/)

        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:internal_server_error)
        json = response.parsed_body
        expect(json).to have_key('error')
        expect(json).to have_key('code')
      end

      it 'OGP画像が生成されていない投稿でクローラーとしてアクセスした場合、デフォルトOGP画像が設定されること' do
        # 何を検証するか: OGP画像生成失敗時にデフォルト画像が使われること
        allow(OgpGeneratorService).to receive(:call).and_return(nil)

        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.body).to include('/ogp/default.png')
      end
    end

    context 'XSS対策' do
      it 'HTMLタグを含む投稿でクローラーとしてアクセスした場合、エスケープされたHTMLが返ること' do
        # 何を検証するか: XSS攻撃を防ぐためにHTMLエスケープが行われること
        xss_post = create(:post, :scored, nickname: '<script>alert("XSS")</script>', body: 'テスト', average_score: 50.0)
        create(:judgment, :hiroyuki, post_id: xss_post.id, succeeded: true)

        get "/api/posts/#{xss_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.body).to include('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
        expect(response.body).not_to include('<script>alert("XSS")</script>')
      end

      it 'JavaScriptイベントハンドラを含む投稿でクローラーとしてアクセスした場合、エスケープされたHTMLが返ること' do
        # 何を検証するか: XSS攻撃を防ぐためにHTMLエスケープが行われること
        xss_post = create(:post, :scored, nickname: '太郎" onmouseover="alert(1)', body: 'テスト', average_score: 50.0)
        create(:judgment, :hiroyuki, post_id: xss_post.id, succeeded: true)

        get "/api/posts/#{xss_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        expect(response).to have_http_status(:ok)
        expect(response.body).to include('&quot; onmouseover=&quot;alert(1)&quot;')
        expect(response.body).not_to include('onmouseover=')
      end
    end

    context 'キャッシュ制御' do
      it 'クローラー向けHTMLに適切なCache-Controlヘッダーが設定されること' do
        # 何を検証するか: クローラー向けHTMLに適切なキャッシュヘッダーが設定されること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Twitterbot/1.0' }

        cache_control = response.headers['Cache-Control']
        expect(cache_control).to include('public')
        expect(cache_control).to include('max-age=3600')
      end

      it '通常ユーザー向けJSONに適切なCache-Controlヘッダーが設定されること' do
        # 何を検証するか: 通常ユーザー向けJSONに適切なキャッシュヘッダーが設定されること
        get "/api/posts/#{scored_post.id}", headers: { 'User-Agent' => 'Mozilla/5.0' }

        cache_control = response.headers['Cache-Control']
        expect(cache_control).to include('public')
      end
    end
  end
end
