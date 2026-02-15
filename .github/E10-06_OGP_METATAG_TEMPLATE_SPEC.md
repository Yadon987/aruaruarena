---
name: E10-06 OGP Metatag Template
about: OGPメタタグ用HTMLテンプレートの作成（TDD準拠）
title: '[SPEC] E10-06 OGP Metatag Template'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

クローラー向けOGPメタタグを含むHTMLテンプレートを作成する。

## 🎯 目的

- SNSクローラー（Twitterbot, facebookexternalhit等）にOGPメタタグを提供する
- ユーザーエージェントに応じて適切な内容を返却する

## 📝 詳細仕様

### 機能要件

1. **HTMLテンプレート**
   - OGPメタタグ: `og:title`, `og:description`, `og:image`, `og:type`, `og:url`
   - Twitterカード: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
   - JavaScriptリダイレクト: 通常ユーザーをSPAへ誘導

2. **JavaScriptリダイレクト**
   - 通常ユーザーはSPA（React）へリダイレクト
   - `window.location.href` による即時リダイレクト

3. **noscriptタグ**
   - JavaScript無効時の代替リンク

### 非機能要件

- 環境変数からSPA URL・CloudFront URLを取得する

## 🔧 技術仕様

### ERBテンプレート

```erb
<!-- app/views/ogp/show.html.erb -->
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>あるあるアリーナ - <%= post.nickname %>の「<%= post.body %>」</title>

  <!-- OGPメタタグ -->
  <meta property="og:title" content="あるあるアリーナ - <%= post.nickname %>の「<%= post.body %>」">
  <meta property="og:description" content="平均点<%= post.average_score %>点、ランキング<%= rank %>位（全<%= total_count %>件中）">
  <meta property="og:image" content="<%= "#{ENV['CLOUDFRONT_URL']}/ogp/posts/#{post.id}.png" %>">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta property="og:url" content="<%= "#{ENV['CLOUDFRONT_URL']}/posts/#{post.id} %>">

  <!-- Twitterカード -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="あるあるアリーナ - <%= post.nickname %>の「<%= post.body %>」">
  <meta name="twitter:description" content="平均点<%= post.average_score %>点、ランキング<%= rank %>位">
  <meta name="twitter:image" content="<%= "#{ENV['CLOUDFRONT_URL']}/ogp/posts/#{post.id}.png" %>">
</head>
<body>
  <!-- 通常ユーザーにはReact SPAを返却（JavaScriptリダイレクト） -->
  <script>
    window.location.href = "<%= "#{ENV['SPA_URL']}/posts/#{post.id}" %>";
  </script>
  <noscript>
    <p>JavaScriptを有効にしてください。<a href="<%= "#{ENV['SPA_URL']}/posts/#{post.id}" %>">ここ</a>をクリックしてください。</p>
  </noscript>
</body>
</html>
```

### 環境変数

| 変数名 | 説明 |
|-------|------|
| `CLOUDFRONT_URL` | CloudFrontのURL |
| `SPA_URL` | SPA（React）のURL |

### ビューコントローラー

```ruby
# app/controllers/ogp_controller.rb
class OgpController < ApplicationController
  def show
    @post = Post.find(params[:id])
    @rank = @post.calculate_rank
    @total_count = Post.total_scored_count
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    render file: Rails.root.join('public', '404.html'), status: :not_found
  end
end
```

## 🧪 テスト計画 (TDD)

### View Spec

```ruby
# spec/views/ogp/show_html_spec.rb
RSpec.describe 'ogp/show.html.erb' do
  let(:post) { create(:post, :scored, average_score: 85.5) }
  let(:rank) { 10 }
  let(:total_count) { 500 }

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with('CLOUDFRONT_URL').and_return('https://cdn.example.com')
    allow(ENV).to receive(:[]).with('SPA_URL').and_return('https://app.example.com')
  end

  context '正常系 (Happy Path)' do
    it 'OGPメタタグが含まれていること' do
      render template: 'ogp/show', locals: { post:, rank:, total_count: }

      expect(rendered).to include('<meta property="og:title"')
      expect(rendered).to include('<meta property="og:description"')
      expect(rendered).to include('<meta property="og:image"')
      expect(rendered).to include('<meta property="og:type"')
      expect(rendered).to include('<meta property="og:url"')
    end

    it '投稿情報が反映されていること' do
      render template: 'ogp/show', locals: { post:, rank:, total_count: }

      expect(rendered).to include(post.nickname)
      expect(rendered).to include(post.body)
      expect(rendered).to include('85.5点')
      expect(rendered).to include('第10位')
      expect(rendered).to include('全500件中')
    end

    it 'Twitterカードメタタグが含まれていること' do
      render template: 'ogp/show', locals: { post:, rank:, total_count: }

      expect(rendered).to include('<meta name="twitter:card"')
      expect(rendered).to include('<meta name="twitter:title"')
      expect(rendered).to include('<meta name="twitter:description"')
      expect(rendered).to include('<meta name="twitter:image"')
    end

    it 'JavaScriptリダイレクトが含まれていること' do
      render template: 'ogp/show', locals: { post:, rank:, total_count: }

      expect(rendered).to include('window.location.href')
      expect(rendered).to include('https://app.example.com/posts/' + post.id)
    end

    it 'noscriptタグが含まれていること' do
      render template: 'ogp/show', locals: { post:, rank:, total_count: }

      expect(rendered).to include('<noscript>')
      expect(rendered).to include('</noscript>')
    end
  end
end
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: 投稿情報とランキング情報が提供される
- **When**: テンプレートをレンダリングする
- **Then**: OGPメタタグが含まれている
- **And**: Twitterカードメタタグが含まれている
- **And**: JavaScriptリダイレクトが含まれている
- **And**: noscriptタグが含まれている

## 🔗 関連資料

- `backend/app/views/ogp/show.html.erb`: 新規作成ファイル
- `backend/app/controllers/ogp_controller.rb`: 新規作成ファイル
- `backend/config/routes.rb`: ルーティング設定（`GET /posts/:id`）

## レビュアーへの確認事項

- [ ] OGPメタタグが正しく定義されている
- [ ] Twitterカードメタタグが正しく定義されている
- [ ] JavaScriptリダイレクトが実装されている
- [ ] noscriptタグが実装されている
- [ ] 環境変数からURLを取得している
- [ ] ビュースペックがすべて通過している
