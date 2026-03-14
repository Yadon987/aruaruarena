# 動的OGP設定レビュー結果と修正方針

最終更新: 2026-03-13

## 結論

今回のレビューで、元の計画のうち以下は妥当だと確認できた。

- Rails 側のクローラー判定が Lambda@Edge と不一致
- `frontend/index.html` に静的 OGP がない
- 投稿 OGP HTML に `og:image:width` / `og:image:height` がない
- frontend 配信物に `/ogp/default.png` を載せる導線がない
- `UploadOgpImageService` が `OGP_S3_BUCKET` 未設定時に明示ログを出していない

一方で、以下はこの Issue で即実施すべきではないと判断した。

- `OgpController` の削除
- `escape_single_quotes` へのバッククォート追加
- Ruby の `Timeout.timeout` による MiniMagick タイムアウト制御

## 現状確認

コードベースを確認した結果、OGP 配信経路は次の通りだった。

- `/posts/:id`
  - 通常ユーザー: CloudFront -> frontend S3 -> SPA
  - クローラー: CloudFront + Lambda@Edge -> API Gateway -> Rails `Api::PostsController#show`
- `/ogp/posts/:id.png`
  - CloudFront 本番系では frontend S3 の静的 PNG を配信
  - Rails には `OgpController` と `/ogp/posts/:id.png` ルートが残っており、直アクセス・ローカル確認・既存 request spec では利用されている

重要な補足:
CloudFront では `403/404 -> /index.html` の SPA フォールバックが distribution 全体に設定されているため、S3 上に `/ogp/posts/:id.png` が存在しない場合は PNG ではなく `index.html` が返る。
この状態で `OgpController` まで削除すると、画像欠損時のフォールバック経路が完全になくなる。

## 妥当だった指摘

### 1. クローラー判定の不一致

- Terraform の Lambda@Edge は 10 種のクローラーを判定している
- Rails の `OgpMetaTagService` は 5 種しか判定していない
- API 直アクセス時に Rails 側だけ取りこぼす可能性がある

対応:

- Rails のクローラー判定を Lambda@Edge と一致させる
- service spec / request spec を追加して回帰を防ぐ

### 2. `frontend/index.html` の静的 OGP 不足

- トップページや OGP 対象外ページをシェアしたときの基本メタタグが存在しない
- 本番ドメインは既存の `VITE_FRONTEND_BASE_URL` を使うのが自然

対応:

- `frontend/index.html` に `og:*` / `twitter:*` を追加する
- URL には `%VITE_FRONTEND_BASE_URL%` を使う

### 3. `og:image:width` / `og:image:height` の不足

- 投稿用 OGP HTML に画像サイズ情報がなく、クローラーの画像解釈が遅れる余地がある

対応:

- `OgpMetaTagService.generate_html` に `1200x630` を明示する

### 4. `/ogp/ogps.webp` 配置フローの不足

- frontend デプロイは `frontend/dist` を `aws s3 sync` している
- `backend/app/assets/images/default_ogp.png` を置いても frontend S3 には載らない
- 既存の `default_ogp.png` は 512x512 の赤丸画像で、OGP デフォルト用途には不向き

対応:

- `frontend/public/ogp/ogps.webp` を静的 OGP 画像として使用する
- 画像は 1200x630 の `backend/app/assets/images/base_ogp.png` を流用する
- これで既存の frontend デプロイだけで `/ogp/ogps.webp` が配信される

### 5. `UploadOgpImageService` の未設定ログ不足

- `OGP_S3_BUCKET` が空でも `false` を返すだけで原因がログに残らない

対応:

- `UploadOgpImageService.call` で明示エラーログを出して早期リターンする

## 今回は見送った項目

### 1. `OgpController` の削除

削除見送り理由:

- 本番 CloudFront の配信経路では主経路ではないが、完全なデッドコードではない
- README / docs / request spec がまだこのルートを参照している
- S3 欠損時の CDN フォールバックが未解決なため、削除はリスクが高い

削除の前提条件:

1. `/ogp/posts/*.png` 欠損時に `index.html` ではなく適切な fallback PNG を返す導線を CDN または配信経路に用意する
2. README / docs / spec の参照先を整理する
3. 直アクセスの運用要否を確認する

### 2. バッククォートのエスケープ追加

見送り理由:

- 現在の MiniMagick 呼び出しはシェル文字列連結ではなく、元計画の「バッククォートでコマンドインジェクション」は根拠が弱い
- 今の論点は shell injection より MVG 文字列の安全な組み立てであり、既存のバックスラッシュ・シングルクォート処理の方が重要

### 3. `Timeout.timeout` の追加

見送り理由:

- Ruby の `Timeout.timeout` は外部プロセス制御として扱いづらい
- MiniMagick のタイムアウトはライブラリ設定側で管理する方が安全
- まずは必要性を実測で確認してから別 Issue で入れるべき

## 今回の実装内容

### backend

- `backend/app/services/ogp_meta_tag_service.rb`
  - クローラー判定を 10 種へ拡張
  - `og:image:width` / `og:image:height` を追加
- `backend/app/services/upload_ogp_image_service.rb`
  - `OGP_S3_BUCKET` 未設定時のエラーログ追加
- `backend/app/controllers/ogp_controller.rb`
  - フォールバック画像を `base_ogp.png` に変更
- `backend/spec/services/ogp_meta_tag_service_spec.rb`
  - 追加クローラーと画像サイズメタタグを検証
- `backend/spec/requests/api/posts_meta_tags_spec.rb`
  - Googlebot / LinkedInBot の request spec と画像サイズメタタグ検証を追加
- `backend/spec/services/upload_ogp_image_service_spec.rb`
  - 未設定ログの spec を追加
- `backend/spec/support/ogp_test_helpers.rb`
  - `OgpController::DEFAULT_OGP_IMAGE_PATH` を使うよう修正

### frontend

- `frontend/index.html`
  - 静的 OGP / Twitter Card を追加
- `frontend/public/ogp/ogps.webp`
  - frontend 配信物として default OGP を追加
- `frontend/tests/workflow/frontendStaticOgp.test.ts`
  - 静的 OGP タグと公開画像配置を検証
- `frontend/README.md`
  - `VITE_FRONTEND_BASE_URL` の用途を追記

## 残課題

### 1. `/ogp/posts/:id.png` 欠損時の CDN fallback

現状:

- S3 に画像がなければ CloudFront の SPA フォールバックで `index.html` が返る

次の打ち手候補:

- CloudFront / 別オリジン / fallback パス設計を見直す
- 既存投稿向け再生成ジョブの運用を明確化する
- `og:image` の fallback 戦略を別 Issue 化する

### 2. `OgpController` 削除判断

前項が解決してから再評価する。

## 検証コマンド

backend:

```bash
bundle exec rspec
bundle exec rubocop -A
bundle exec brakeman -q
```

frontend:

```bash
npm test -- --run frontend/tests/workflow/frontendStaticOgp.test.ts
```
