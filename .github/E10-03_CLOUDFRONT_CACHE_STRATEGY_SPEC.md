---
name: E10-03 CloudFront Cache Strategy
about: CloudFrontキャッシュ戦略の実装（TDD準拠）
title: '[SPEC] E10-03 CloudFront Cache Strategy'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

OGP画像エンドポイントのCloudFrontキャッシュ戦略（1週間）を実装する。

## 🎯 目的

- OGP画像のCloudFrontキャッシュ期間を1週間（604,800秒）に設定する
- 不要なAPIリクエストを削減し、コスト・パフォーマンスを最適化する

## 📝 詳細仕様

### 機能要件

1. **コントローラー実装**
   - エンドポイント: `GET /ogp/posts/:id.png`
   - Cache-Controlヘッダー: `public, max-age=604800`
   - Content-Type: `image/png`
   - 存在しない投稿の場合は404を返す

2. **ルーティング設定**
   - `config/routes.rb`にルート追加
   - UUID形式のバリデーション（constraints: `{ id: /[0-9a-f-]+/ }`）

### 非機能要件

- 画像生成失敗時は404を返す
- エラーレスポンスは統一エラーフォーマット（`{ error: "...", code: "..." }`）

## 🔧 技術仕様

### API設計

| メソッド | パス | コンテンツタイプ | キャッシュ |
|---------|------|-----------------|-----------|
| GET | `/ogp/posts/:id.png` | `image/png` | 1週間 |

### コントローラーインターフェース

```ruby
# 実装ではOgpController（Apiモジュールなし）となっている
class OgpController < ApplicationController
    CACHE_CONTROL = 'public, max-age=604800'.freeze

    def show
      post = Post.find(params[:id])
      return render_not_found unless post.status == Post::STATUS_SCORED

      image = OgpGeneratorService.call(post.id)
      return render_not_found if image.nil?

      send_data(
        image.to_blob,
        filename: "#{post.id}.png",
        type: 'image/png',
        disposition: 'inline'
      )
    rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
      render_not_found
    end

    private

    def render_not_found
      render json: {
        error: '投稿が見つかりません',
        code: 'NOT_FOUND'
      }, status: :not_found
    end
end
```

### ルーティング設定

```ruby
# OGP画像エンドポイント（:api namespaceの外に配置）
get '/ogp/posts/:id.png', to: 'ogp#show', format: false
```

## 🧪 テスト計画 (TDD)

### Request Spec (API)

```ruby
# spec/requests/api/ogp_spec.rb
RSpec.describe 'API::OGP', type: :request do
  describe 'GET /ogp/posts/:id.png' do
    let(:post) { create(:post, :scored) }
    let(:judgments) { create_list(:judgment, 3, post_id: post.id) }

    before { judgments }

    context '正常系 (Happy Path)' do
      it '200 OKでPNG画像が返ること' do
        get "/ogp/posts/#{post.id}.png"
        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('image/png')
        expect(response.body.length).to be > 1000
      end

      it 'Cache-Controlヘッダーが1週間に設定されていること' do
        get "/ogp/posts/#{post.id}.png"
        expect(response.headers['Cache-Control']).to eq('public, max-age=604800')
      end
    end

    context '異常系 (Error Path)' do
      it 'judging状態の投稿は404を返すこと' do
        post.update(status: 'judging')
        get "/ogp/posts/#{post.id}.png"
        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['error']).to eq('投稿が見つかりません')
        expect(json['code']).to eq('NOT_FOUND')
      end

      it 'failed状態の投稿は404を返すこと' do
        post.update(status: 'failed')
        get "/ogp/posts/#{post.id}.png"
        expect(response).to have_http_status(:not_found)
      end

      it '不正なUUIDは404を返すこと' do
        get '/ogp/posts/invalid-id.png'
        expect(response).to have_http_status(:not_found)
      end

      it '存在しないIDは404を返すこと' do
        get '/ogp/posts/00000000-0000-0000-0000-000000000000.png'
        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: scored状態の投稿が存在する
- **When**: `GET /ogp/posts/:id.png` を実行する
- **Then**: ステータスコードが200である
- **And**: Content-Typeが`image/png`である
- **And**: Cache-Controlヘッダーが`public, max-age=604800`である

### 異常系 (Error Path)

- **Given**: judging状態の投稿が存在する
- **When**: `GET /ogp/posts/:id.png` を実行する
- **Then**: ステータスコードが404である
- **And**: エラーレスポンスが統一フォーマットである（`{ error: "...", code: "NOT_FOUND" }`）

## 🔗 関連資料

- `backend/app/controllers/api/ogp_controller.rb`: 新規作成ファイル
- `backend/config/routes.rb`: ルーティング設定
- `backend/app/services/ogp_generator_service.rb`: 画像生成サービス

## レビュアーへの確認事項

- [ ] Cache-Controlヘッダーが正しく設定されている（1週間）
- [ ] Content-Typeがimage/pngである
- [ ] UUID形式のバリデーションが実装されている
- [ ] エラーレスポンスが統一フォーマットである
- [ ] 判定ロジックが正しい（scoredのみ許可）
- [ ] リクエストスペックがすべて通過している
