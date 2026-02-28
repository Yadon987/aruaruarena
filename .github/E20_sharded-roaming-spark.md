---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E20 OGP画像生成完成'
labels: 'spec'
assignees: ''
---

## 📋 概要

OGP画像生成機能を完成させるため、Docker環境へのImageMagick追加とOGPベース画像の作成を行う。

現在の課題：
- DockerfileにImageMagickが未インストールのため、本番環境でmini_magickが動作しない
- 既存のベース画像が512x512ピクセルで、Twitter/X推奨の1200x630に未対応
- 審査員情報まで描画すると情報過多になるため、シンプル化が必要

## 🎯 目的

- SNSシェア時に適切なOGP画像を表示し、クリック率を向上させる
- 本番環境（AWS Lambda）でOGP画像生成を正常に動作させる
- ユーザーの投稿内容とスコアを視覚的にアピールする

---

## 📝 詳細仕様

### 機能要件

- DockerfileのbaseステージにImageMagickを追加する
- CI環境（GitHub Actions）にImageMagickを追加する
- OGPベース画像を1200x630ピクセルで作成・配置する
- OgpGeneratorServiceから審査員描画ロジックを削除する（シンプル化）
  - `draw_judgments`メソッドを削除
  - `JUDGE_ICON_PATHS`, `JUDGE_COLORS`定数を削除
  - `LAYOUT`定数から審査員関連の設定を削除（`judges_start_y`, `judges_x_offset`, `judges_y_step`, `icon`, `judge_score_y_offset`, `judge_comment_y_offset`, `judge_text_x_offset`）
  - `FONT_SIZES`定数から審査員関連の設定を削除（`judge_score`, `judge_comment`）
  - `@judgments = @post.judgments.to_a`の呼び出しを削除
- 既存画像（`.github/OGPs.png`）をリサイズ・圧縮して配置する

### 非機能要件

- OGP画像ファイルサイズ: 1MB以下（Twitter/X推奨）
- 画像フォーマット: PNG
- Dockerイメージサイズへの影響: 約10-15MB増加（imagemagickパッケージ）
- `--no-install-recommends`使用で最小構成
- OGP画像生成レスポンスタイム: OgpGeneratorService#executeの実行時間が3秒以内（Lambdaタイムアウト29秒以内）
- 画像生成失敗時はnilを返し、`GET /ogp/posts/:id.png` は404を返す（現行動作）
- エラーログは`Rails.logger.error`レベルで出力
- OGP画像は都度生成する（キャッシュしない）
- Lambdaのコールドスタート対策はEventBridgeウォームアップで対応済み

### UI/UX設計

**OGP画像レイアウト（1200x630）:**

| 要素 | 位置 | フォントサイズ | 色 | 最大文字数 |
|------|------|---------------|-----|-----------|
| ニックネーム | (100, 100) | 48px | #333333 | 20文字（21文字以上で`...`付き切り詰め） |
| 投稿本文 | (100, 160) | 36px | #333333 | 50文字（51文字以上で`...`付き切り詰め） |
| 総合スコア | (900, 100) | 72px | #FF6B6B | 小数第1位まで表示（例: 85.5点） |
| ランキング | (900, 180) | 36px | #666666 | TOP20外は「圏外」と表示 |

**削除する要素（シンプル化）:**
- 3人の審査員アイコン
- 審査員ごとのスコア
- 審査員コメント
- `draw_judgments`メソッド
- `JUDGE_ICON_PATHS`定数
- `JUDGE_COLORS`定数
- `@judgments`インスタンス変数
- `LAYOUT`定数の審査員関連設定
- `FONT_SIZES`定数の審査員関連設定

**ベース画像デザイン:**
- アリーナ風ステージ with スポットライト
- 紫〜マゼンタのグラデーション背景（#667eea → #764ba2）
- トロフィーアイコン（右上）
- 紙吹雪エフェクト
- テキストエリアは比較的シンプルに保つ

**文字列制限仕様:**
- ニックネーム: 最大20文字（21文字以上は先頭20文字+`...`）
- 投稿本文: 最大50文字（51文字以上は先頭50文字+`...`）
- 絵文字: NotoSansJPフォントは絵文字非対応のため、`sanitize_text`で**削除**する（トーフ防止）
- 空文字の場合: 空欄のまま描画（エラーにしない）

**クローラー判定:**
- 既存の`OgpMetaTagService`でUser-Agentベースの判定を実施
- 対象: Twitterbot, facebookexternalhit, line-poker, Discordbot, Slackbot

**デフォルトOGP画像:**
- パス: `backend/app/assets/images/default_ogp.png`
- 本Issueの受け入れ範囲では使用しない（現行の非`scored`投稿や画像生成失敗時は404応答）

---

## 🔧 技術仕様

### データモデル (DynamoDB)

変更なし（既存のPost, Judgmentテーブルを使用）
※Judgmentテーブルへのクエリが削除されるため、パフォーマンス向上が見込める

### API設計

- `GET /api/posts/:id`: クローラーアクセス時にOGPメタタグを含むHTMLを返す
- `GET /ogp/posts/:id.png`: OGP画像バイナリを返す

### 画像処理

| 項目 | 値 |
|------|-----|
| 元画像 | `.github/OGPs.png` (2848x1504) |
| 出力サイズ | 1200x630 |
| フォーマット | PNG |
| 目標ファイルサイズ | 1MB以下 |
| 使用ツール | ImageMagick (convertコマンド) |
| イメージサイズ増加 | 約10-15MB |

**リサイズ・圧縮コマンド:**
```bash
convert .github/OGPs.png -resize 1200x630 -quality 85 -define png:compression-level=9 backend/app/assets/images/base_ogp.png
```

### セキュリティ考慮事項

- `sanitize_text`メソッドで制御文字を削除し、改行は半角スペースへ置換する（タブは保持）
- `escape_single_quotes`でバックスラッシュ（`\`）とシングルクォート（`'`）をエスケープ
  - 対象: `\` → `\\`, `'` → `\'`
  - 参照: `backend/app/services/ogp_generator_service.rb:277-280`
- ImageMagick MVGパーサーに対するコマンドインジェクション対策として、ユーザー入力をサニタイズ
- 絵文字は`sanitize_text`で削除（フォント非対応のため、トーフ防止）
- HTMLタグやJavaScriptコードが含まれる場合も、`sanitize_text`で制御文字削除により実質的に無害化
- ImageMagickのpolicy.xml設定: 本番環境ではMVG/PDF等の危険なフォーマットを無効化することを推奨（別Issueで対応）

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)

**正常系:**
- [ ] 正常系: ImageMagickがインストール済み環境でOGP画像が生成される
- [ ] 正常系: 生成画像のサイズが1200x630である
- [ ] 正常系: 生成画像のフォーマットがPNGである
- [ ] 正常系: 審査員情報が描画されない（シンプル化確認）
- [ ] 正常系: ニックネームが20文字以内で正しく描画される
- [ ] 正常系: ニックネームがちょうど20文字の場合、`...`なしで描画される
- [ ] 正常系: 投稿本文が50文字以内で正しく描画される
- [ ] 正常系: 投稿本文がちょうど50文字の場合、`...`なしで描画される
- [ ] 正常系: ランキングが「第○位」形式で描画される
- [ ] 正常系: ランキングが圏外（TOP20外）の場合「圏外」と描画される
- [ ] 正常系: スコアが整数（例: 85点）の場合「85.0点」と描画される
- [ ] 正常系: スコアが小数（例: 85.5点）の場合「85.5点」と描画される
- [ ] 正常系: average_scoreがnilの場合「0.0点」と描画される（フォールバック）
- [ ] 正常系: ニックネームが空文字の場合、空欄のまま描画される
- [ ] 正常系: 投稿本文が空文字の場合、空欄のまま描画される

**異常系:**
- [ ] 異常系: ベース画像が存在しない場合nilを返す
- [ ] 異常系: フォントファイルが存在しない場合nilを返す
- [ ] 異常系: 投稿が存在しない場合nilを返す
- [ ] 異常系: 投稿ステータスが`judging`の場合nilを返す
- [ ] 異常系: 投稿ステータスが`failed`の場合nilを返す

**境界値:**
- [ ] 境界値: ニックネームが21文字の場合、先頭20文字+`...`で描画される
- [ ] 境界値: 投稿本文が51文字の場合、先頭50文字+`...`で描画される
- [ ] 境界値: 投稿本文に絵文字が含まれる場合、絵文字が削除されて描画される
- [ ] 境界値: 投稿本文に改行が含まれる場合、改行が半角スペースに置換されて描画される
- [ ] 境界値: スコアが0点の場合「0.0点」と描画される
- [ ] 境界値: スコアが100点の場合「100.0点」と描画される

### Request Spec (API)

- [ ] `GET /api/posts/:id` - クローラーアクセス時にOGP HTMLが返る
- [ ] `GET /api/posts/:id` - ステータスが`judging`の場合、404エラーが返る
- [ ] `GET /api/posts/:id` - ステータスが`failed`の場合、404エラーが返る
- [ ] `GET /api/posts/:id` - 投稿が存在しない場合、404エラーが返る

### Docker Build Test

- [ ] Dockerビルドが成功する
- [ ] `convert --version`コマンドが成功する
- [ ] Dockerイメージサイズが想定範囲内（約10-15MB増加）
- [ ] テストが全件通過する

### CI Test

- [ ] CI環境でImageMagickがインストールされる
- [ ] CI環境でテストが全件通過する

### 既存テスト修正

**削除対象テストケース（`ogp_generator_service_spec.rb`）:**
- [ ] `describe '#draw_judgments'` ブロック全体を削除
- [ ] 審査員アイコン合成のテストを削除
- [ ] 審査員スコア描画のテストを削除
- [ ] 審査員コメント描画のテストを削除
- [ ] `JUDGE_ICON_PATHS`のモック設定を削除
- [ ] `@judgments`のスタブ設定を削除

### E2E Test (Playwright) - オプション

- [ ] SNSシェア時に正しいOGPメタタグが出力される（別Issueで対応検討）

### 目視確認

- [ ] 生成されたOGP画像を目視確認（文字が読めるか、レイアウト崩れがないか）

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** ImageMagickがインストールされたDockerコンテナ
      **When** OgpGeneratorService.call(post_id)を実行
      **Then** 1200x630ピクセルのPNG画像が返る

- [ ] **Given** 1200x630のベース画像が配置されている
      **When** OGP画像を生成
      **Then** ニックネーム、本文、スコア、ランキングが描画される

- [ ] **Given** スコア済みの投稿が存在する
      **When** クローラーがGET /api/posts/:idにアクセス
      **Then** OGPメタタグが含まれたHTMLが返る

- [ ] **Given** ランキング1位の投稿
      **When** OGP画像を生成
      **Then** 「第1位」が描画される

- [ ] **Given** ランキング圏外の投稿（TOP20外）
      **When** OGP画像を生成
      **Then** 「圏外」が描画される

- [ ] **Given** スコアが85.5点の投稿
      **When** OGP画像を生成
      **Then** 「85.5点」と描画される

- [ ] **Given** average_scoreがnilの投稿
      **When** OGP画像を生成
      **Then** 「0.0点」と描画される

- [ ] **Given** ニックネームが空文字の投稿
      **When** OGP画像を生成
      **Then** ニックネーム欄は空欄のまま描画される（エラーにならない）

### 異常系 (Error Path)

- [ ] **Given** ベース画像が存在しない
      **When** OgpGeneratorService.call(post_id)を実行
      **Then** nilが返り、`Rails.logger.error`でエラーログが出力される

- [ ] **Given** 投稿が存在しない
      **When** OgpGeneratorService.call(invalid_id)を実行
      **Then** nilが返る

- [ ] **Given** 投稿ステータスが`judging`
      **When** OgpGeneratorService.call(post_id)を実行
      **Then** nilが返る

- [ ] **Given** 投稿ステータスが`failed`
      **When** OgpGeneratorService.call(post_id)を実行
      **Then** nilが返る

- [ ] **Given** 投稿ステータスが`judging`
      **When** クローラーがGET /api/posts/:idにアクセス
      **Then** 404エラーが返る

- [ ] **Given** 投稿ステータスが`failed`
      **When** クローラーがGET /api/posts/:idにアクセス
      **Then** 404エラーが返る

### 境界値 (Edge Case)

- [ ] **Given** 投稿本文が100文字
      **When** OGP画像を生成
      **Then** 先頭50文字+`...`で切り詰められて描画される

- [ ] **Given** 投稿本文がちょうど50文字
      **When** OGP画像を生成
      **Then** 50文字すべてが`...`なしで描画される

- [ ] **Given** ニックネームが30文字
      **When** OGP画像を生成
      **Then** 先頭20文字+`...`で切り詰められて描画される

- [ ] **Given** ニックネームがちょうど20文字
      **When** OGP画像を生成
      **Then** 20文字すべてが`...`なしで描画される

- [ ] **Given** 投稿本文に絵文字が含まれる
      **When** OGP画像を生成
      **Then** 絵文字が削除されて描画される（トーフが表示されない）

- [ ] **Given** 投稿本文に改行が含まれる
      **When** OGP画像を生成
      **Then** 改行が半角スペースに置換されて描画される

---

## 🔗 関連資料

- `backend/Dockerfile` - ImageMagick追加先
- `backend/.github/workflows/ci.yml` - CI環境設定
- `backend/app/services/ogp_generator_service.rb` - OGP生成サービス
- `backend/app/services/ogp_meta_tag_service.rb` - OGPメタタグ生成サービス（クローラー判定）
- `backend/app/assets/images/base_ogp.png` - ベース画像配置先
- `backend/app/assets/images/default_ogp.png` - 既存画像（本Issueでは未使用）
- `.github/OGPs.png` - 元画像（Gemini NanoBananaで生成）
- `docs/completion_roadmap.md` - P1タスク一覧
- `backend/spec/services/ogp_generator_service_spec.rb` - 既存テスト

---

## 📦 実装ブランチ

| ブランチ名 | 担当範囲 |
|-----------|---------|
| `feature/e20-01-docker-imagemagick` | DockerfileとCIへのImageMagick追加 |
| `feature/e20-02-ogp-base-image` | OGPベース画像作成・OgpGeneratorService簡素化 |

### 依存関係

```
E20-01 (Dockerfile変更)
    ↓ 先にマージ
E20-02 (ベース画像作成）
```

---

## 📝 コミットメッセージ

```
feat: E20-01 DockerfileにImageMagickを追加 #XX

- mini_magick Gemの実行に必要なImageMagickをインストール
- CI環境にも同様に追加してテスト実行を可能にする
- イメージサイズ約10-15MB増加

feat: E20-02 OGPベース画像を1200x630で作成 #XX

- Gemini NanoBananaで生成した画像をリサイズ・圧縮
- OgpGeneratorServiceから審査員描画ロジックを削除
- ニックネーム最大20文字、本文最大50文字に制限
- 絵文字を含む場合の削除処理を追加
- 空文字入力時のエラーハンドリング追加
- OGP仕様（Twitter/X推奨サイズ）に準拠
```

---

## 🔍 検証手順

### E20-01検証（Dockerfile変更後）

```bash
# Dockerビルド確認
cd backend && docker build -t backend:test .

# ImageMagickインストール確認
docker run --rm backend:test convert --version

# イメージサイズ確認
docker images backend:test

# テスト実行
docker run --rm -e RAILS_ENV=test backend:test bundle exec rspec
```

### E20-02検証（ベース画像作成後）

```bash
# 画像サイズ確認
file backend/app/assets/images/base_ogp.png
# 期待出力: PNG image data, 1200 x 630, ...

# 画像ファイルサイズ確認
ls -lh backend/app/assets/images/base_ogp.png
# 期待: 1MB以下

# テスト実行
cd backend && bundle exec rspec spec/services/ogp_generator_service_spec.rb

# コンソールで動作確認
bundle exec rails console
> post = Post.create!(nickname: "テストユーザー", body: "これはテスト投稿です", status: "scored", average_score: 85.5)
> OgpGeneratorService.call(post.id)
# => PNGバイナリが返ることを確認

# 目視確認（生成画像を保存して確認）
> File.binwrite("tmp/test_ogp.png", OgpGeneratorService.call(post.id))
# tmp/test_ogp.pngを目視確認
```

---

**レビュアーへの確認事項:**
- [x] 仕様の目的が明確か
- [x] DynamoDBのキー設計はアクセスパターンに適しているか（変更なし、Judgmentクエリ削除でパフォーマンス向上）
- [x] テスト計画は正常系/異常系/境界値を網羅しているか
- [x] 受入条件はGiven-When-Then形式で記述されているか
- [x] 既存機能や他の仕様と矛盾していないか
- [x] セキュリティ考慮事項が記載されているか
- [x] 非機能要件（レスポンスタイム、イメージサイズ）が定義されているか
- [x] 検証手順が記載されているか
- [x] 削除対象テストケースがリスト化されているか
