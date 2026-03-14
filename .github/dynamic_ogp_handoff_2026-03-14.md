# 動的OGP 引継ぎ資料

作成日: 2026-03-14

## 目的

本番で「投稿詳細の動的OGP画像が表示されない」件について、別セッションでそのまま調査を継続できるように、現時点の事実・仮説・確認手順を整理する。

## 結論サマリ

- ローカル実装ベースでは、動的OGPの Rails 側ロジックが直近変更で破綻した形跡は確認できていない
- 本番で画像が出ない主因として最有力なのは、`/ogp/posts/:id.png` の実体PNGが frontend 用 S3 に存在しないこと
- 本番 CloudFront 配信は Rails `OgpController` 直配信ではなく、`frontend S3 -> CloudFront` の静的配信が主経路
- そのため、OGP HTML の `og:image` が `/ogp/posts/<POST_ID>.png` を指していても、S3 側にファイルが無ければ CloudFront の SPA fallback で `index.html` が返り、「画像が表示されない」状態になりうる

## 重要な理解

### 1. 本番の主経路

- クローラーが投稿URLへ来る
- CloudFront + Lambda@Edge でクローラー判定
- Rails API が OGP HTML を返す
- HTML 内の `og:image` / `twitter:image` は `/ogp/posts/<POST_ID>.png`
- その PNG は本番では frontend 用 S3 バケットの `ogp/posts/` 配下から CloudFront 経由で静的配信される

根拠:

- [docs/deploy/frontend.md](/home/nukon/ws/aruaruarena/docs/deploy/frontend.md)
- [README.md](/home/nukon/ws/aruaruarena/README.md)
- [backend/app/services/upload_ogp_image_service.rb](/home/nukon/ws/aruaruarena/backend/app/services/upload_ogp_image_service.rb)

### 2. Rails `OgpController` は本番主経路ではない

- [backend/app/controllers/ogp_controller.rb](/home/nukon/ws/aruaruarena/backend/app/controllers/ogp_controller.rb) はまだ存在する
- ただし設計上、本番 CloudFront の主経路では `frontend S3` の `ogp/posts/*.png` が使われる
- そのため、ローカル request spec が通っていても、本番の画像欠損は起こりうる

### 3. 画像欠損時の危険な挙動

- frontend CloudFront には SPA 用の `403/404 -> /index.html` fallback がある
- `ogp/posts/<POST_ID>.png` が S3 に存在しない場合、PNG ではなく `index.html` が返る可能性がある
- SNS クローラーから見ると「画像URLなのに画像が来ない」状態になる

根拠:

- [docs/deploy/frontend.md](/home/nukon/ws/aruaruarena/docs/deploy/frontend.md)
- [ .github/EP36-01_ogp_best_practices_review_plan.md ](/home/nukon/ws/aruaruarena/.github/EP36-01_ogp_best_practices_review_plan.md)

## 確認済み事項

### A. OGP HTML 生成ロジック

- [backend/app/services/ogp_meta_tag_service.rb](/home/nukon/ws/aruaruarena/backend/app/services/ogp_meta_tag_service.rb) は以下を返す
  - `og:image` = `#{base_url}/ogp/posts/#{post.id}.png`
  - `twitter:image` = 同上
  - `og:image:width` = `1200`
  - `og:image:height` = `630`

### B. OGP画像アップロードロジック

- [backend/app/services/upload_ogp_image_service.rb](/home/nukon/ws/aruaruarena/backend/app/services/upload_ogp_image_service.rb)
- `scored` 投稿のみ S3 に `ogp/posts/<POST_ID>.png` を保存する
- `CreateCloudFrontInvalidationService` で個別 invalidation する
- 失敗時は `false` を返す

### C. 投稿採点からの呼び出し

- [backend/app/services/concerns/judge_common_concern.rb](/home/nukon/ws/aruaruarena/backend/app/services/concerns/judge_common_concern.rb)
- `persist_scored_post!` 内で `upload_ogp_image(post)` を呼ぶ
- ここでアップロード失敗しても投稿は `scored` に進みうる
- つまり「投稿は公開済みだがOGP画像だけ無い」状態はありうる

### D. 環境変数

- Terraform 上は Lambda に以下を入れる想定
  - `OGP_S3_BUCKET`
  - `CLOUDFRONT_DISTRIBUTION_ID`

根拠:

- [backend/terraform/lambda.tf](/home/nukon/ws/aruaruarena/backend/terraform/lambda.tf)

### E. GitHub Actions の backend deploy

- [ .github/workflows/deploy.yml ](/home/nukon/ws/aruaruarena/.github/workflows/deploy.yml) は Lambda のコード更新と timeout 更新のみ
- この workflow 自体は `OGP_S3_BUCKET` を明示的に設定していない
- 実運用では Lambda 側に既存設定が残っていれば動くが、未設定やズレがあっても workflow からは見えない

## ローカルで確認したテスト結果

### 実行したもの

```bash
cd backend && bundle exec rspec spec/requests/api/ogp_posts_spec.rb spec/services/upload_ogp_image_service_spec.rb spec/requests/api/posts_meta_tags_spec.rb
```

### 結果

- `69 examples, 0 failures, 2 pending`
- ただし SimpleCov の全体閾値未達で exit 2

### 解釈

- Rails 側の request / service 実装は、少なくともローカルテストでは破綻していない
- 本番症状はアプリコードの即時破綻より、配信経路・S3欠損・環境変数・既存投稿未補完が本命

## 現時点の最有力原因候補

### 第一候補: S3 に OGP PNG が存在しない

ありえる原因:

- `OGP_S3_BUCKET` 未設定
- `UploadOgpImageService` 実行失敗
- `OgpGeneratorService` が nil を返した
- 過去投稿が事前生成導入前に作られており、補完されていない

### 第二候補: CloudFront が古いキャッシュまたは fallback を返している

ありえる原因:

- invalidation 未実行または失敗
- 旧キャッシュ残存
- S3 欠損により `index.html` fallback

### 第三候補: 既存投稿の再生成漏れ

ありえる原因:

- 既存投稿は `scored` 済みだが、`ogp/posts/<POST_ID>.png` が一度も作成されていない
- ドキュメント上は `scripts/regenerate_all_ogps.rb` で補完する想定

## まずやるべき本番確認

`<POST_ID>`、`<CLOUDFRONT_DOMAIN>`、`<API_GATEWAY_ENDPOINT>`、`<S3_BUCKET_FRONTEND>` を実値に置き換えること。

### 1. API Gateway 側の OGP HTML を確認

```bash
curl -i -A "Twitterbot/1.0" \
  https://${API_GATEWAY_ENDPOINT}/api/posts/<POST_ID>
```

見る点:

- `200`
- `content-type: text/html`
- `og:image` が `/ogp/posts/<POST_ID>.png` を指している

### 2. CloudFront 側の OGP HTML を確認

```bash
curl -i -A "Twitterbot/1.0" \
  https://${CLOUDFRONT_DOMAIN}/posts/<POST_ID>
```

見る点:

- `200`
- OGP HTML が返る
- `index.html` ではなく OGP 用 HTML になっている

### 3. OGP画像 URL 自体を確認

```bash
curl -I https://${CLOUDFRONT_DOMAIN}/ogp/posts/<POST_ID>.png
```

見る点:

- `200`
- `content-type: image/png`
- `cache-control: max-age=604800, public`

もし `text/html` や `index.html` 相当が返るなら、S3 欠損 + SPA fallback の可能性が高い。

### 4. S3 に実体があるか確認

```bash
aws s3 ls s3://${S3_BUCKET_FRONTEND}/ogp/posts/<POST_ID>.png
```

見る点:

- ファイルが存在するか
- 更新時刻が最近か

### 5. Lambda / アプリログを確認

CloudWatch Logs で以下を探す:

- `UploadOgpImageService`
- `OGP_S3_BUCKET environment variable is not set`
- `OGP画像アップロード成功`
- `OgpGeneratorService`
- `CreateCloudFrontInvalidationService`

## 次セッションで優先して見るべきコード

- [backend/app/services/upload_ogp_image_service.rb](/home/nukon/ws/aruaruarena/backend/app/services/upload_ogp_image_service.rb)
- [backend/app/services/concerns/judge_common_concern.rb](/home/nukon/ws/aruaruarena/backend/app/services/concerns/judge_common_concern.rb)
- [backend/app/services/create_cloud_front_invalidation_service.rb](/home/nukon/ws/aruaruarena/backend/app/services/create_cloud_front_invalidation_service.rb)
- [backend/terraform/lambda.tf](/home/nukon/ws/aruaruarena/backend/terraform/lambda.tf)
- [docs/deploy/frontend.md](/home/nukon/ws/aruaruarena/docs/deploy/frontend.md)

## もし修正を入れるなら候補

### 候補1: OGP画像欠損を検知しやすくする

- `UploadOgpImageService` 失敗時のログを強化
- `JudgeCommonConcern` 側でも warning 以上の運用シグナルを出す

### 候補2: 欠損時 fallback を CDN 側で安全化

- `/ogp/posts/*.png` 欠損時に `index.html` ではなく専用 fallback PNG を返す設計を検討

### 候補3: 既存投稿を再生成

- `scripts/regenerate_all_ogps.rb` を使って既存 `scored` 投稿の PNG を再作成

## このセッションで変更したが、動的OGPの主因ではなさそうなもの

- [backend/app/services/ogp_generator_service.rb](/home/nukon/ws/aruaruarena/backend/app/services/ogp_generator_service.rb)
  - バッククォートをエスケープするよう変更
- [backend/spec/services/ogp_generator_service_spec.rb](/home/nukon/ws/aruaruarena/backend/spec/services/ogp_generator_service_spec.rb)
  - 上記の回帰テストを追加

これは ImageMagick の安全性向上であり、「本番で画像が突然出なくなった」直接原因としては薄い。

## 最後に

次セッションの担当者は、まず「CloudFront の `/ogp/posts/<POST_ID>.png` が実際に何を返しているか」を確認すること。
そこが `image/png` でない場合、Rails ではなく S3 / CloudFront / 事前生成のどこかに問題がある。
