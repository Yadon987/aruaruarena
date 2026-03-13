# 動的OGP設定のベストプラクティスレビューと修正プラン

## Context

現在の動的OGP設定について、ベストプラクティスとの比較、矛盾・欠陥の特定、実行順序の最適化をレビューし、修正プランを作成する。

### 現状のアーキテクチャ
- **サーバーサイドレンダリング方式**: Lambda@Edge + Rails API
- **画像生成**: MiniMagick (1200x630px PNG)
- **事前生成**: 審査完了時にS3へアップロード
- **キャッシュ**: CloudFront経由で配信

### 設計前提
- 投稿は作成後**編集不可**（編集時のキャッシュ無効化は考慮不要）
- 投稿削除は**論理削除のみ**（物理削除時のS3オブジェクト削除は考慮不要）
- DynamoDBの結果整合性回避のため、Postオブジェクトは直接渡す

---

## 発見した問題点

### 問題1: クローラー判定の不一致【優先度: 高】

| ロケーション | クローラーパターン数 |
|------------|------------------|
| Lambda@Edge (Python) | 10種類 (googlebot, bingbot, linkedinbot, pinterest, applebot含む) |
| OgpMetaTagService (Ruby) | 5種類 (上記5つが含まれていない) |

**影響**: 直接APIアクセス時にRails側で誤判定する可能性

**判断基準**: Lambda@Edgeのパターンを正とし、OgpMetaTagServiceを合わせる
- 理由: Lambda@Edgeがフロントラインであり、まずここで判定されるため

### 問題2: index.htmlにOGPタグがない【優先度: 高】

- トップページ、ランキングページなどがシェアされた場合、OGPが表示されない
- SEO上も望ましくない

### 問題3: OgpControllerがデッドコード【優先度: 中】

- CloudFront設定で `/ogp/posts/*.png` はS3オリジンを指している
- OgpControllerへのルーティングは存在するが、CloudFrontレベルでS3に向いているため**到達不能**
- **削除対象**（削除前にアクセスログを1週間確認し、アクセスがないことを検証すること）

### 問題4: og:image:width/heightがない【優先度: 低】

- Facebook等で画像のアスペクト比が正しく認識されるまで時間がかかる場合がある

### 問題5: default.pngの配置フローがない【優先度: 高】

- index.htmlで参照する `/ogp/default.png` がS3に配置されていない可能性がある

### 問題6: ImageMagickコマンドインジェクション対策の強化が必要【優先度: 高】

- バッククォート（`）のエスケープが不足している

---

## 修正プラン

### Phase 1: 必須修正

#### 1-1. クローラー判定の統一

**ファイル**: `backend/app/services/ogp_meta_tag_service.rb`

    # ruby
    # 修正前
    CRAWLER_KEYWORDS = %w[twitterbot facebookexternalhit line-poker discordbot slackbot].freeze

    # 修正後（Lambda@Edgeと統一）
    CRAWLER_KEYWORDS = %w[
      twitterbot
      facebookexternalhit
      line-poker
      discordbot
      slackbot
      googlebot
      bingbot
      linkedinbot
      pinterest
      applebot
    ].freeze

#### 1-2. index.htmlに基本OGPタグ追加

**ファイル**: `frontend/index.html`

    # html
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>あるあるアリーナ</title>
        <meta name="description" content="3人のAI審査員が採点する、超短文「あるある」ランキング" />

        <!-- OGP基本タグ -->
        <meta property="og:title" content="あるあるアリーナ" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://aruaruarena.com/" />
        <meta property="og:image" content="https://aruaruarena.com/ogp/default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:description" content="3人のAI審査員が採点する、超短文「あるある」ランキング" />
        <meta property="og:site_name" content="あるあるアリーナ" />
        <meta property="og:locale" content="ja_JP" />

        <!-- Twitter Card -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="あるあるアリーナ" />
        <meta name="twitter:description" content="3人のAI審査員が採点する、超短文「あるある」ランキング" />
        <meta name="twitter:image" content="https://aruaruarena.com/ogp/default.png" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>

**注意**: ドメインは当面本番環境用のハードコードで対応。環境別対応は別Issueで検討。

#### 1-3. OgpControllerの削除

**前提条件**:
- CloudWatch Logsで `/ogp/posts/*.png` へのAPI直接アクセスを1週間確認し、アクセスがないことを検証すること

**削除対象**:
- `backend/app/controllers/ogp_controller.rb`
- `backend/config/routes.rb` の `get '/ogp/posts/:id.png'` ルート

#### 1-4. default.pngのS3配置

**ファイル**: 新規作成またはTerraformリソース追加

**手順**:
1. `backend/app/assets/images/default_ogp.png` を作成（または既存ファイルを使用）
2. デプロイスクリプトまたはTerraformでS3の `/ogp/default.png` に配置

    # bash
    # 手動配置コマンド例
    aws s3 cp backend/app/assets/images/default_ogp.png \
      s3://{OGP_S3_BUCKET}/ogp/default.png \
      --cache-control "max-age=31536000, public" \
      --content-type "image/png"

#### 1-5. ImageMagickコマンドインジェクション対策強化

**ファイル**: `backend/app/services/ogp_generator_service.rb`

    # ruby
    # 修正前
    def escape_single_quotes(text)
      text.gsub('\\') { '\\\\' }.gsub("'") { "\\'" }
    end

    # 修正後（バッククォートもエスケープ）
    def escape_single_quotes(text)
      text.gsub('\\') { '\\\\' }.gsub("'") { "\\'" }.gsub('`') { '\\`' }
    end

### Phase 2: 推奨修正

#### 2-1. 投稿OGPに画像サイズメタタグ追加

**ファイル**: `backend/app/services/ogp_meta_tag_service.rb`

    # ruby
    # 定数に追加
    IMAGE_WIDTH = 1200
    IMAGE_HEIGHT = 630

    # generate_htmlメソッド内に追加
    <meta property="og:image:width" content="#{IMAGE_WIDTH}">
    <meta property="og:image:height" content="#{IMAGE_HEIGHT}">

#### 2-2. OGP画像生成のタイムアウト設定

**ファイル**: `backend/app/services/ogp_generator_service.rb`

    # ruby
    # executeメソッド内でMiniMagick処理にタイムアウトを設定
    require 'timeout'

    def execute
      return nil unless valid_post?
      return nil unless ensure_resources_exist?

      Timeout.timeout(5) do
        image = create_base_image
        return nil if image.nil?

        draw_post_info(image)
        compress_png(image)

        log_success
        image.to_blob
      end
    rescue Timeout::Error => e
      log_error("Image generation timeout: #{e.message}")
      nil
    rescue MiniMagick::Error => e
      log_error("Image generation failed: #{e.message}")
      nil
    rescue StandardError => e
      log_error("Unexpected error: #{e.class} - #{e.message}")
      nil
    end

#### 2-3. S3バケット名チェックの強化

**ファイル**: `backend/app/services/upload_ogp_image_service.rb`

    # ruby
    class << self
      def call(post_or_id, s3_client: nil)
        if bucket_name.empty?
          Rails.logger.error("[UploadOgpImageService] OGP_S3_BUCKET environment variable is not set")
          return false
        end

        new(post_or_id, s3_client: s3_client || build_s3_client).execute
      end
    end

---

## 修正ファイル一覧

| ファイル | 修正内容 |
|---------|---------|
| `backend/app/services/ogp_meta_tag_service.rb` | クローラー判定統一、画像サイズタグ追加 |
| `backend/app/services/ogp_generator_service.rb` | バッククォートエスケープ追加、タイムアウト設定 |
| `backend/app/services/upload_ogp_image_service.rb` | バケット名チェック強化 |
| `frontend/index.html` | 基本OGPタグ追加 |
| `backend/app/controllers/ogp_controller.rb` | **削除**（アクセスログ確認後） |
| `backend/config/routes.rb` | OGP画像ルート削除 |
| `backend/spec/services/ogp_meta_tag_service_spec.rb` | テスト追加 |
| `backend/app/assets/images/default_ogp.png` | デフォルトOGP画像作成 |

---

## テスト追加項目

### OgpMetaTagService.crawler? テスト

    # ruby
    # 追加するテストケース
    context '追加クローラーパターン' do
      it 'googlebotを含むUser-Agentでtrueを返すこと' do
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (compatible; Googlebot/2.1)')).to be true
      end

      it 'bingbotを含むUser-Agentでtrueを返すこと' do
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (compatible; bingbot/2.0)')).to be true
      end

      it 'linkedinbotを含むUser-Agentでtrueを返すこと' do
        expect(described_class.crawler?(user_agent: 'LinkedInBot/1.0')).to be true
      end

      it 'pinterestを含むUser-Agentでtrueを返すこと' do
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (compatible; Pinterest/0.2)')).to be true
      end

      it 'applebotを含むUser-Agentでtrueを返すこと' do
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.2.5 (KHTML, like Gecko) Version/8.0.2 Safari/600.2.5 (Applebot/0.1)')).to be true
      end
    end

### OgpGeneratorService.escape_single_quotes テスト

    # ruby
    describe '.escape_single_quotes' do
      it 'バッククォートをエスケープすること' do
        expect(described_class.new(nil).send(:escape_single_quotes, '`rm -rf /`')).to include('\\`')
      end

      it 'バッククォートとシングルクォートが混在する場合も正しくエスケープすること' do
        result = described_class.new(nil).send(:escape_single_quotes, "`echo 'hello'`")
        expect(result).to include('\\`')
        expect(result).to include("\\'")
      end
    end

---

## 検証手順

### 1. テスト実行

    # bash
    cd backend && bundle exec rspec spec/services/ogp_meta_tag_service_spec.rb
    cd backend && bundle exec rspec spec/services/ogp_generator_service_spec.rb

### 2. OGPデバッガーで確認

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LINE URLプレビュー](https://poker.line.naver.jp/)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### 3. トップページのOGP確認

    https://aruaruarena.com/

### 4. 投稿ページのOGP確認

    https://aruaruarena.com/posts/{post_id}

### 5. クローラー偽装での統合テスト

    # bash
    # Twitterbotとしてアクセス
    curl -A "Twitterbot/1.0" https://aruaruarena.com/posts/{post_id}

    # Googlebotとしてアクセス
    curl -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://aruaruarena.com/posts/{post_id}

    # LinkedIn Botとしてアクセス
    curl -A "LinkedInBot/1.0" https://aruaruarena.com/posts/{post_id}

### 6. default.pngの存在確認

    # bash
    # S3上のファイル確認
    aws s3 ls s3://{OGP_S3_BUCKET}/ogp/default.png

    # CloudFront経由でのアクセス確認
    curl -I https://aruaruarena.com/ogp/default.png

---

## ベストプラクティス確認サマリ

| 項目 | 現状 | 修正後 |
|-----|------|-------|
| クローラー判定の整合性 | 不一致 | 統一済み（Lambda@Edge準拠） |
| トップページOGP | なし | 追加済み |
| default.png配置 | なし | 配置済み |
| og:image:width/height | なし | 追加済み |
| デッドコード | OgpController存在 | 削除済み |
| ImageMagickエスケープ | 不完全 | 完全化済み |
| 画像生成タイムアウト | なし | 設定済み（5秒） |
| 画像サイズ | 1200x630px | 適合 (変更なし) |
| キャッシュ戦略 | 7日 | 適切 (変更なし) |

---

## 実行順序

1. **Phase 1-1**: クローラー判定統一（テスト追加含む）
2. **Phase 1-4**: default.pngのS3配置
3. **Phase 1-2**: index.htmlにOGPタグ追加
4. **Phase 1-5**: ImageMagickエスケープ強化
5. **Phase 2-2, 2-3**: タイムアウト・バケット名チェック強化
6. **Phase 2-1**: 画像サイズタグ追加
7. **検証**: 全てのOGPデバッガーで確認
8. **Phase 1-3**: アクセスログ確認後、OgpController削除

---

*このドキュメントは実装完了後に更新してください*
