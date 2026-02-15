---
name: E10-05 OGP Image Generation Test
about: RSpecテスト（画像生成・キャッシュ）の実装（TDD準拠）
title: '[SPEC] E10-05 OGP Image Generation Test'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

OGP画像生成機能の総合テストを実装する。

## 🎯 目的

- E10-00〜E10-04の実装を検証する
- カバレッジ90%以上を達成する

## 📝 詳細仕様

### テストカテゴリ

1. **単体テスト（Service）**
   - `spec/services/ogp_generator_service_spec.rb`
   - OgpGeneratorServiceの全機能を検証

2. **統合テスト（Request）**
   - `spec/requests/api/ogp_spec.rb`
   - OGPエンドポイントの動作を検証

3. **ウォームアップテスト（Service）**
   - `spec/services/judge_post_service_spec.rb`（追加）
   - 審査完了時のOGP画像生成トリガーを検証

### カバレッジ目標

| カテゴリ | カバレッジ目標 |
|---------|--------------|
| OgpGeneratorService | 95% |
| OgpController | 90% |
| ウォームアップ処理 | 90% |

## 🔧 技術仕様

### テストヘルパー

```ruby
# spec/support/ogp_test_helpers.rb
module OgpTestHelpers
  def expect_ogp_image_generated(post_id)
    image = OgpGeneratorService.call(post_id)
    expect(image).not_to be_nil
    expect(image.format).to eq('PNG')
    expect(image.width).to eq(1200)
    expect(image.height).to eq(630)
  end

  def mock_ogp_generation_success
    allow(OgpGeneratorService).to receive(:call).and_return(mock_image)
  end

  def mock_ogp_generation_failure
    # 仕様では画像生成失敗時は例外をログ出力してnilを返すため、モックもnilを返す
    allow(OgpGeneratorService).to receive(:call).and_return(nil)
  end

  private

  def mock_image
    image = MiniMagick::Image.open(Rails.root.join('spec', 'fixtures', 'images', 'mock_ogp.png'))
    image
  end
end

RSpec.configure do |config|
  config.include OgpTestHelpers, type: :service
end
```

## 🧪 テスト計画 (TDD)

### 完全なテストスイート

```ruby
# spec/services/ogp_generator_service_spec.rb
RSpec.describe OgpGeneratorService do
  include OgpTestHelpers

  describe '定数' do
    it '画像サイズ定数が定義されていること' do
      expect(described_class::IMAGE_WIDTH).to eq(1200)
      expect(described_class::IMAGE_HEIGHT).to eq(630)
    end

    it '審査員カラーコードが定義されていること' do
      expect(described_class::JUDGE_COLORS).to include(
        'hiroyuki' => '#4A90E2',
        'dewi' => '#F5A623',
        'nakao' => '#D0021B'
      )
    end
  end

  describe '.call' do
    let(:post) { create(:post, :scored) }

    context '正常系 (Happy Path)' do
      before { create_list(:judgment, 3, post_id: post.id) }

      it 'OGP画像を生成できること' do
        image = described_class.call(post.id)
        expect_ogp_image_generated(post.id)
      end

      it '画像サイズが正しいこと' do
        image = described_class.call(post.id)
        expect(image.width).to eq(described_class::IMAGE_WIDTH)
        expect(image.height).to eq(described_class::IMAGE_HEIGHT)
      end

      it '画像フォーマットがPNGであること' do
        image = described_class.call(post.id)
        expect(image.format).to eq('PNG')
      end
    end

    context '異常系 (Error Path)' do
      it 'judging状態の投稿はnilを返すこと' do
        post.update(status: 'judging')
        image = described_class.call(post.id)
        expect(image).to be_nil
      end

      it 'failed状態の投稿はnilを返すこと' do
        post.update(status: 'failed')
        image = described_class.call(post.id)
        expect(image).to be_nil
      end

      it '投稿が見つからない場合はnilを返すこと' do
        expect(Rails.logger).to receive(:warn).with(/Post not found/)
        result = described_class.call('nonexistent_id')
        expect(result).to be_nil
      end
    end
  end

  describe '画像合成' do
    let(:post) { create(:post, :scored) }

    before { create_list(:judgment, 3, post_id: post.id) }

    it '投稿内容が画像に描画されること' do
      image = described_class.call(post.id)
      expect(image).not_to be_nil
    end

    it '平均点・ランキングが画像に描画されること' do
      post = create(:post, :scored, average_score: 85.5)
      allow_any_instance_of(Post).to receive(:rank).and_return(10)
      create_list(:judgment, 3, post_id: post.id)

      image = described_class.call(post.id)
      expect(image).not_to be_nil
    end

    it '審査員スコア・コメントが画像に描画されること' do
      image = described_class.call(post.id)
      expect(image).not_to be_nil
    end
  end
end

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

      it '画像サイズがOGP推奨サイズであること' do
        get "/ogp/posts/#{post.id}.png"
        image = MiniMagick::Image.read(response.body)
        expect(image.width).to eq(1200)
        expect(image.height).to eq(630)
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

### テスト実行

- **Given**: 全テストが実装されている
- **When**: `bundle exec rspec` を実行する
- **Then**: 全テストが通過する
- **And**: カバレッジが90%以上である

## 🔗 関連資料

- `backend/spec/services/ogp_generator_service_spec.rb`: サービス単体テスト
- `backend/spec/requests/api/ogp_spec.rb`: 統合テスト
- `backend/spec/services/judge_post_service_spec.rb`: ウォームアップテスト
- `backend/spec/support/ogp_test_helpers.rb`: テストヘルパー

## レビュアーへの確認事項

- [ ] 単体テスト（Service）が実装されている
- [ ] 統合テスト（Request）が実装されている
- [ ] ウォームアップテストが実装されている
- [ ] テストヘルパーが作成されている
- [ ] 全テストが通過している
- [ ] カバレッジが90%以上である
- [ ] SimpleCovでカバレッジレポートを確認できる
