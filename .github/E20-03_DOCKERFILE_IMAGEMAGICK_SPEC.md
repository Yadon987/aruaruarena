---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E20-03 OGP生成の本番対応（ImageMagick/フォールバック/キャッシュ）'
labels: 'spec, infrastructure'
assignees: ''
---

## 📋 概要
本番環境（AWS Lambda）でOGP画像生成を安定して動作させるための3つの対応を行う。

**背景:**
- `mini_magick` gemはGemfileで定義済みだが、ImageMagickバイナリがDockerイメージに含まれていない
- OGP生成失敗時にデフォルト画像を返すフォールバック機能がない
- メタタグエンドポイント（クローラー向けHTML/通常ユーザー向けJSON）にCache-Controlが未設定

**注意:** E20-01/E20-02は既にマージ済み。本Issueはこれらの追加対応。

## 🎯 目的
- 本番環境（AWS Lambda）でOGP画像生成を正常に動作させる
- OGP生成失敗時でもデフォルト画像を返し、ユーザー体験を損なわない
- キャッシュ制御によりCDN/ブラウザでのキャッシュ効率を向上させる
- Dockerイメージサイズへの影響を最小限に抑える

---

## 📝 詳細仕様

### 機能要件

#### 1. DockerfileへのImageMagick追加
- `backend/Dockerfile`の`base`ステージに`imagemagick`パッケージを追加する
- `backend/.github/workflows/ci.yml`の`test`ジョブに`imagemagick`パッケージを追加する
- マルチステージビルド構成を維持する
- `--no-install-recommends`オプションを使用し、最小構成でインストールする

#### 2. デフォルト画像フォールバック
- デフォルトOGP画像（`default_ogp.png`）を`app/assets/images/`に配置する
- **作成責任者:** 本Issueの実装担当者が作成し、実装と同時にコミットする
- `OgpController#show`でOGP生成失敗時にデフォルト画像を返すように変更する
- **OGP生成失敗の定義:**
  - `OgpGeneratorService.call`が`nil`を返した場合
  - `MiniMagick::Error`が発生した場合
- デフォルト画像は1200x630ピクセルのPNG形式とする
- デフォルト画像にもCache-Controlを設定する
- **デフォルト画像が存在しない場合:** 500エラーを返し、`Rails.logger.error`でログを出力する

#### 3. Cache-Control設定
- `/ogp/posts/:id.png`: 既に実装済み（7日間、public） - 変更なし
- `/api/posts/:id`（クローラー向けHTML）: 新規設定
- `/api/posts/:id`（通常ユーザー向けJSON）: 新規設定
- **`public`設定の根拠:** 本サービスは認証なしの公開コンテンツであるため、`public`キャッシュ設定で問題ない

### 非機能要件
- Dockerイメージサイズ増加: 約10-15MB（ImageMagick追加による）
- OGP画像生成レスポンスタイム: 3秒以内（Lambdaタイムアウト29秒以内）
- **Lambda メモリ設定:** 現在の設定（例: 512MB）で動作確認を行い、必要に応じて増強を検討する
- キャッシュ期間:
  - OGP画像: 7日間（604800秒） - 投稿内容が固定されるため長期キャッシュ
  - クローラー向けHTML: 1時間（3600秒） - 投稿の再審査可能性を考慮して短期キャッシュ
  - 通常ユーザー向けJSON: 1時間（3600秒） - 同上
- セキュリティ:
  - 公式Debianリポジトリからインストールし、セキュリティパッチを適用
  - ImageMagickのpolicy.xml設定で危険なフォーマット（MVG/PDF等）を無効化（別Issue E21で対応、**優先度: 高**）
- ログ出力:
  - フォールバック発生時: `Rails.logger.warn`で警告ログを出力
  - デフォルト画像不存在時: `Rails.logger.error`でエラーログを出力

### UI/UX設計
- デフォルトOGP画像のデザイン:
  - サイトロゴ/タイトル「あるあるアリーナ」を中央に配置
  - 背景色: 白（#FFFFFF）またはブランドカラー
  - フォント: NotoSansJP（既存フォントを流用）
  - シンプルで汎用的なデザイン
  - 1200x630ピクセル（OGP標準サイズ）

### 並行処理時の挙動
- **現状:** OGP画像は都度生成であり、同一投稿への並行リクエスト時は重複生成される
- **投稿削除後のキャッシュ:** 投稿削除時のキャッシュ無効化は現時点では対応しない（キャッシュ期限で自然消失）

---

## 🔧 技術仕様

### 変更内容

#### 1. Dockerfile（baseステージ）

baseステージを選択する理由: 最終イメージ（final stage）はbaseステージを継承するため、実行時に必要なImageMagickはbaseに追加する必要がある。

**変更前（18-20行目付近）:**
~~~dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
~~~

**変更後:**
~~~dockerfile
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 imagemagick && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
~~~

#### 2. CI（ci.yml testジョブ）

**変更前（50-51行目付近）:**
~~~yaml
- name: Install packages
  run: sudo apt-get update && sudo apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config
~~~

**変更後:**
~~~yaml
- name: Install packages
  run: sudo apt-get update && sudo apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config imagemagick
~~~

#### 3. OgpController（フォールバック実装）

**変更前:**
~~~ruby
def show
  post = Post.where(id: params[:id]).first
  return render_not_found if post.nil? || post.status != Post::STATUS_SCORED

  image_data = OgpGeneratorService.call(post.id)

  if image_data
    response.headers['Cache-Control'] = 'max-age=604800, public'
    send_data image_data, type: 'image/png', disposition: 'inline'
  else
    render_not_found
  end
rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
  render_not_found
end
~~~

**変更後:**
~~~ruby
DEFAULT_OGP_IMAGE_PATH = Rails.root.join('app/assets/images/default_ogp.png')

def show
  post = Post.where(id: params[:id]).first
  return render_not_found if post.nil? || post.status != Post::STATUS_SCORED

  image_data = OgpGeneratorService.call(post.id)

  if image_data
    response.headers['Cache-Control'] = 'max-age=604800, public'
    send_data image_data, type: 'image/png', disposition: 'inline'
  else
    # OGP生成失敗時はデフォルト画像を返す（フォールバック）
    send_default_ogp_image
  end
rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
  render_not_found
rescue MiniMagick::Error => e
  # ImageMagickエラー時もデフォルト画像にフォールバック
  Rails.logger.warn "[OgpController] MiniMagick error for post #{params[:id]}: #{e.message}"
  send_default_ogp_image
end

private

def send_default_ogp_image
  unless File.exist?(DEFAULT_OGP_IMAGE_PATH)
    Rails.logger.error "[OgpController] Default OGP image not found: #{DEFAULT_OGP_IMAGE_PATH}"
    render json: { error: 'Internal server error', code: 'INTERNAL_ERROR' }, status: :internal_server_error
    return
  end

  Rails.logger.warn "[OgpController] Serving default OGP image for post #{params[:id]}"
  response.headers['Cache-Control'] = 'max-age=3600, public'
  send_file DEFAULT_OGP_IMAGE_PATH, type: 'image/png', disposition: 'inline'
end
~~~

#### 4. Api::PostsController（Cache-Control設定）

**変更内容:**
- クローラー向けHTML: `Cache-Control: max-age=3600, public`
- 通常ユーザー向けJSON: `Cache-Control: max-age=3600, public`

~~~ruby
# show アクション内で追加
def show
  # ... 既存処理 ...

  if crawler?
    html = OgpMetaTagService.generate_html(post: @post, base_url: base_url)
    response.headers['Cache-Control'] = 'max-age=3600, public'
    render html: html.html_safe, layout: false
  else
    response.headers['Cache-Control'] = 'max-age=3600, public'
    render json: PostSerializer.new(@post).as_json
  end
end
~~~

#### 5. デフォルトOGP画像

**配置場所:** `backend/app/assets/images/default_ogp.png`
**仕様:**
- サイズ: 1200x630px
- フォーマット: PNG
- 内容: 「あるあるアリーナ」ロゴ/タイトル
- 背景: 白またはブランドカラー

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | N/A（変更なし） |
| PK | N/A |
| SK | N/A |
| GSI | N/A |

### API設計
| 項目 | 値 |
|------|-----|
| Method | N/A（変更なし） |
| Path | N/A |
| Request Body | N/A |
| Response (成功) | N/A |
| Response (失敗) | N/A |

### AIプロンプト設計
- N/A（インフラ変更のみ）

### 依存関係
- `mini_magick` gem: Gemfile 36行目で既に定義済み
- ImageMagickバイナリ: `convert`コマンドが必要

---

## 🧪 テスト計画 (TDD)

### 実装フェーズ

#### Phase 1: Red（テスト作成）
1. フォールバック機能のテストを作成（スキップ状態）
2. Cache-Control設定のテストを作成（スキップ状態）
3. ImageMagick関連のテストを作成

#### Phase 2: Green（機能実装）
1. DockerfileにImageMagick追加
2. CIにImageMagick追加
3. デフォルト画像作成・配置
4. OgpControllerにフォールバック実装
5. Api::PostsControllerにCache-Control設定
6. テストのスキップ解除

#### Phase 3: Refactor（リファクタリング）
1. コードの整理
2. テストの可読性向上

### Unit Test (Model/Service)
- [ ] 正常系: ImageMagickがインストール済み環境で`convert --version`が成功する
- [ ] 正常系: OgpGeneratorService#executeがPNGバイナリを返す
- [ ] 異常系: ImageMagickが未インストールの場合、MiniMagick::Errorが発生する（※CIではスキップ）

### Request Spec (API)
#### OGP画像
- [ ] `GET /ogp/posts/:id.png` - 正常にPNG画像が返る
- [ ] `GET /ogp/posts/:id.png` - Cache-Controlヘッダーが`max-age=604800, public`であること
- [ ] `GET /ogp/posts/:id.png` - OGP生成失敗時にデフォルト画像が返る（スキップ解除）
- [ ] `GET /ogp/posts/:id.png` - デフォルト画像のCache-Controlが`max-age=3600, public`であること
- [ ] `GET /ogp/posts/:id.png` - MiniMagick::Error発生時にデフォルト画像が返る
- [ ] `GET /ogp/posts/:id.png` - デフォルト画像不存在時に500エラーが返る（スキップ解除）

**スキップ解除対象テスト（spec/requests/api/ogp_posts_spec.rb）:**
- 「OGP画像生成失敗時にデフォルト画像が使われること」

#### メタタグ（クローラー向けHTML）
- [ ] `GET /api/posts/:id` - クローラーにHTMLが返る
- [ ] `GET /api/posts/:id` - Cache-Controlヘッダーが`max-age=3600, public`であること（スキップ解除）

**スキップ解除対象テスト（spec/requests/api/posts_meta_tags_spec.rb）:**
- 「クローラー向けHTMLに適切なCache-Controlヘッダーが設定されること」

#### 通常ユーザー向けJSON
- [ ] `GET /api/posts/:id` - 通常ユーザーにJSONが返る
- [ ] `GET /api/posts/:id` - Cache-Controlヘッダーが`max-age=3600, public`であること（スキップ解除）

**スキップ解除対象テスト（spec/requests/api/posts_meta_tags_spec.rb）:**
- 「通常ユーザー向けJSONに適切なCache-Controlヘッダーが設定されること」

### External Service (WebMock/VCR)
- N/A（外部サービスに依存しない）

### CI Test
- [ ] CI環境でImageMagickがインストールされる（`convert --version`の実行確認）
- [ ] CI環境でテストが全件通過する

### Docker Build Test
- [ ] Dockerビルドが成功する
- [ ] `convert --version`コマンドが成功する
- [ ] Dockerイメージサイズが想定範囲内（約10-15MB増加）
- [ ] **注:** Docker Build TestのCI自動化は別Issueで検討

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系

#### ImageMagick
- [ ] **Given** ImageMagickがインストールされたDockerコンテナ
      **When** `convert --version`を実行
      **Then** バージョン情報が表示される

- [ ] **Given** ImageMagickがインストールされたDockerコンテナ
      **When** OgpGeneratorService.call(post_id)を実行
      **Then** 1200x630ピクセルのPNG画像が返る

#### フォールバック
- [ ] **Given** OGP生成が失敗する状況（OgpGeneratorServiceがnilを返す）
      **When** `GET /ogp/posts/:id.png`をリクエスト
      **Then** デフォルト画像が返る

- [ ] **Given** MiniMagick::Errorが発生する状況
      **When** `GET /ogp/posts/:id.png`をリクエスト
      **Then** デフォルト画像が返る

- [ ] **Given** デフォルト画像が返される
      **When** レスポンスヘッダーを確認
      **Then** `Cache-Control: max-age=3600, public`が設定されている

- [ ] **Given** フォールバックが発生
      **When** ログを確認
      **Then** 警告ログ（`Rails.logger.warn`）が出力されている

#### Cache-Control
- [ ] **Given** クローラー（Twitterbot）からのリクエスト
      **When** `GET /api/posts/:id`をリクエスト
      **Then** HTMLが返り、`Cache-Control: max-age=3600, public`が設定されている

- [ ] **Given** 通常ユーザーからのリクエスト
      **When** `GET /api/posts/:id`をリクエスト
      **Then** JSONが返り、`Cache-Control: max-age=3600, public`が設定されている

### 異常系
- [ ] **Given** ImageMagickがインストールされていない環境
      **When** OgpGeneratorService.call(post_id)を実行
      **Then** MiniMagick::Errorが発生する

- [ ] **Given** デフォルト画像ファイルが存在しない
      **When** `GET /ogp/posts/:id.png`をリクエスト（フォールバック発生時）
      **Then** 500エラーが返る

- [ ] **Given** デフォルト画像ファイルが存在しない
      **When** フォールバック発生
      **Then** エラーログ（`Rails.logger.error`）が出力されている

### 境界値
- [ ] **Given** Dockerイメージをビルド
      **When** イメージサイズを確認
      **Then** ベースイメージから約10-15MBの増加に収まる

---

## 🔗 関連資料
- `backend/Dockerfile` - ImageMagick追加先
- `backend/.github/workflows/ci.yml` - CI環境設定
- `backend/Gemfile` - mini_magick gem定義（36行目）
- `backend/app/controllers/ogp_controller.rb` - OGP画像コントローラー
- `backend/app/controllers/api/posts_controller.rb` - 投稿APIコントローラー
- `backend/app/services/ogp_generator_service.rb` - OGP生成サービス
- `backend/app/services/ogp_meta_tag_service.rb` - メタタグ生成サービス
- `backend/spec/requests/api/posts_meta_tags_spec.rb` - テスト（スキップ解除対象）
- `backend/spec/requests/api/ogp_posts_spec.rb` - OGP画像テスト
- `.github/E20_sharded-roaming-spark.md` - E20親仕様書

---

**レビュアーへの確認事項:**
- [ ] 仕様の目的が明確か
- [ ] Dockerfileへの追加箇所が適切か（baseステージ）
- [ ] CI環境への追加が必要か
- [ ] デフォルト画像のデザイン方針は適切か
- [ ] Cache-Controlの期間設定（7日/1時間）は適切か
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] セキュリティ考慮事項（policy.xml設定）について別Issueで対応することが明記されているか
- [ ] エラーハンドリングとログ出力仕様が適切か

---

## 検証手順

### Dockerビルド確認
~~~bash
# 変更前のイメージサイズ確認（ベースライン）
cd backend && docker build -t backend:base .

# 変更後のDockerビルド
docker build -t backend:test .

# ImageMagickインストール確認
docker run --rm backend:test convert --version

# イメージサイズ比較
docker images backend:base --format "{{.Size}}"
docker images backend:test --format "{{.Size}}"
# 期待: 約10-15MB増加

# テスト実行
docker run --rm -e RAILS_ENV=test backend:test bundle exec rspec
~~~

### ローカルテスト
~~~bash
# テスト実行（スキップされているテストの解除確認）
cd backend && bundle exec rspec spec/requests/api/posts_meta_tags_spec.rb
bundle exec rspec spec/requests/api/ogp_posts_spec.rb

# 全テスト実行
bundle exec rspec
~~~

---

## セキュリティ注意事項

### ImageMagickの既知の脆弱性への対応
- ImageMagickには過去に重大な脆弱性（ImageTragick: CVE-2016-3714等）が報告されている
- 本Issueではパッケージインストールのみを行い、policy.xmlによる危険なフォーマット無効化は**別Issue E21**で対応する（**優先度: 高**）
- セキュリティアップデートは`apt-get update`で公式リポジトリから取得

### 今後の対応（E21予定）
~~~xml
<!-- /etc/ImageMagick-6/policy.xml に追加予定 -->
<policy domain="coder" rights="none" pattern="MVG" />
<policy domain="coder" rights="none" pattern="PDF" />
<policy domain="coder" rights="none" pattern="EPS" />
~~~

---

## 実装チェックリスト

### Phase 1: Red
- [ ] フォールバックテスト作成
- [ ] Cache-Controlテスト作成
- [ ] テストが失敗することを確認

### Phase 2: Green
- [ ] Dockerfile変更
- [ ] CI設定変更
- [ ] デフォルト画像作成・配置
- [ ] OgpController変更
- [ ] Api::PostsController変更
- [ ] テストのスキップ解除
- [ ] テストが通ることを確認

### Phase 3: Refactor
- [ ] コードレビュー
- [ ] リファクタリング
- [ ] テストが通ることを確認
