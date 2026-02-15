---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E10-06〜E10-07: OGPメタタグ配信 (Meta Tags & Crawler)'
labels: 'spec, E10'
assignees: ''
---

## 📋 概要
SPA (Single Page Application) において、SNSクローラーに対して適切なOGPメタタグを含むHTMLを配信するための仕組みを構築します。
Lambda@Edgeを使用してUser-Agentを判定し、クローラーには静的なHTML（またはSSRされたHTML）、通常ユーザーには通常のReactアプリを返却します。

## 🎯 目的
- Twitter, Facebook, LINEなどでURLがシェアされた際、正しくOGP画像、タイトル、説明文が表示されるようにする
- SPA特有の「クローラーがJavaScriptを実行できずOGPを取得できない」問題を解決する

---

## 📝 詳細仕様

### 機能要件
- **User-Agent判定**: リクエストヘッダーのUser-Agentを見て、主要なSNSクローラーを識別する
  - 対象: `Twitterbot`, `facebookexternalhit`, `line-poker`, `Discordbot`, `Slackbot` 等
  - 判定方法: User-Agent文字列に上記キーワードが含まれる場合、クローラーとみなす
  - 管理方法: 環境変数 `CRAWLER_USER_AGENTS` にカンマ区切りでキーワードを定義（例: `Twitterbot,facebookexternalhit,line-poker,Discordbot,Slackbot`）
- **動的HTML生成**: クローラーの場合、投稿データを埋め込んだHTMLを返却する
  - `<meta property="og:title" content="...">`
  - `<meta property="og:image" content="...">` (`/ogp/posts/:id.png` を指定)
  - `<meta property="og:description" content="...">`
  - HTMLエスケープ処理: タイトル、説明文は必ずHTMLエスケープ（XSS対策）
- **通常アクセス**: クローラー以外の場合は、通常のS3上のReactアプリ（`index.html`）へリクエストを流す

### 非機能要件
- **パフォーマンス**: Lambda@Edgeの実行時間は50ms以内（通常ユーザーへのレイテンシ影響を+100ms以内に抑える）
- **キャッシュ戦略**: CloudFrontでクローラー向けHTMLをキャッシュ（TTL: 1時間）
- **メンテナンス性**: クローラーのUser-Agentリストは環境変数で管理し、Lambdaの再デプロイなしで更新可能にする
- **レート制限**: クローラーに対してはレート制限を適用しない（ただし、User-Agent偽装による悪意あるリクエストにはCloudFront WAFで対処）

### UI/UX設計
- ユーザーには直接関係しないが、シェアされたカードの見た目（タイトル、説明文）を適切に設計する
- タイトル例: 「{nickname}さんのあるある投稿 | あるあるアリーナ」
- 説明文例: 「{body} (スコア: {score}点)」
  - 最大文字数: 200文字（超過する場合は末尾を「...」で省略）

---

## 🔧 技術仕様

### 構成 (AWS)
- **CloudFront**: エッジロケーションでリクエストを受ける
- **Lambda@Edge**: Origin Requestイベントで発火し、User-Agent判定とHTML生成を行う
- **DynamoDB**: 投稿データの取得に使用（Lambda@Edgeから直接アクセス）
  - テーブル: `Posts` テーブル
  - PK: `PK` (例: `POST#投稿ID`)
  - GSI: 必要に応じて検討（投稿ID単独での取得が可能な設計）

### DynamoDBアクセス設計
- **直接アクセス方式**: Lambda@EdgeからDynamoDBへ直接アクセス
  - IAMロール: Lambda実行ロールに `dynamodb:GetItem` 権限を付与
  - エラーハンドリング: アクセス失敗時はオリジン（S3）へリクエストを転送

### テンプレート設計
- クローラー用HTMLテンプレートをLambda関数内で構築
- 必要なメタタグ:
  - `og:title`: 投稿タイトル
  - `og:type`: `article`
  - `og:url`: 投稿ページURL（リクエストのパスから生成）
  - `og:image`: `/ogp/posts/:id.png`
  - `og:description`: 投稿説明文（200文字制限）
  - `og:site_name`: `あるあるアリーナ`
  - `og:locale`: `ja_JP`
  - `twitter:card`: `summary_large_image`
  - `twitter:site`: (アカウント情報がある場合は指定)

### エラーハンドリング
- **投稿が見つからない場合**: 404ステータスを返す
- **OGP画像が生成されていない場合**: デフォルトOGP画像URLを返す（`/ogp/default.png`）
- **DynamoDBアクセス失敗**: オリジン（S3）へリクエストを転送（通常のReactアプリを返却）
- **Lambda@Edge実行失敗**: オリジン（S3）へリクエストを転送

---

## 🧪 テスト計画 (TDD)

### Unit Test (Lambda Logic)
- [ ] クローラーのUser-Agentリストに含まれる場合、`true` を返すこと
- [ ] 通常のブラウザのUser-Agentの場合、`false` を返すこと
- [ ] User-Agentが空文字列の場合、`false` を返すこと
- [ ] User-Agentが不正な形式（null等）の場合、`false` を返すこと
- [ ] HTML生成ロジックが正しいメタタグを出力すること
- [ ] タイトル・説明文がHTMLエスケープされること（XSS対策）
- [ ] 説明文が200文字を超える場合、末尾が「...」で省略されること
- [ ] 投稿が見つからない場合、404エラーが返されること
- [ ] OGP画像URLが存在しない場合、デフォルト画像URLが設定されること

### Integration Test
- [ ] `curl -A "Twitterbot/1.0"` でリクエストした場合、OGPタグを含むHTMLが返ること
- [ ] `curl -A "facebookexternalhit/1.1"` でリクエストした場合、OGPタグを含むHTMLが返ること
- [ ] `curl -A "line-poker"` でリクエストした場合、OGPタグを含むHTMLが返ること
- [ ] 通常の `curl` (またはブラウザ) でリクエストした場合、Reactアプリの `index.html` が返ること
- [ ] 存在しない投稿IDでアクセスした場合、404が返ること
- [ ] OGP画像が生成されていない投稿でアクセスした場合、デフォルトOGP画像が設定されること
- [ ] DynamoDBアクセス失敗時、オリジンのHTMLが返ること

### Example Mapping (網羅性確認)

| シナリオ | User-Agent | 投稿存在 | OGP画像存在 | 期待される結果 |
|----------|-----------|---------|-----------|---------------|
| 正常系: クローラー + 有効投稿 | Twitterbot | 有効 | 有効 | OGPタグ付きHTML |
| 正常系: 通常ユーザー | Chrome | 有効 | - | 通常のReactアプリ |
| 異常系: 投稿が見つからない | Twitterbot | 不在 | - | 404エラー |
| 異常系: OGP画像が存在しない | Twitterbot | 有効 | 不在 | デフォルトOGP画像付きHTML |
| 異常系: User-Agentが空 | (空) | 有効 | - | 通常のReactアプリ |
| 異常系: User-Agentがnull | (null) | 有効 | - | 通常のReactアプリ |
| 異常系: DynamoDBアクセス失敗 | Twitterbot | - | - | オリジンのHTML |
| 境界値: 説明文が200文字 | Twitterbot | 有効 | 有効 | 正常に表示 |
| 境界値: 説明文が201文字 | Twitterbot | 有効 | 有効 | 末尾が「...」で省略 |

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Crawler)
- [ ] **Given** 有効な投稿IDがある
      **When** Twitterbotとして投稿詳細ページURLにアクセスする
      **Then** `og:image` に `/ogp/posts/:id.png` が設定されたHTMLが返される
      **And** `og:title` に `{nickname}さんのあるある投稿 | あるあるアリーナ` が設定されている
      **And** `og:description` に `{body} (スコア: {score}点)` が設定されている
      **And** すべてのメタタグが正しくエスケープされている

### 正常系 (User)
- [ ] **Given** 有効な投稿IDがある
      **When** ブラウザ（Chrome/Safari）で投稿詳細ページURLにアクセスする
      **Then** 通常のReactアプリケーションがロードされる
      **And** Lambda@Edgeの実行が+100ms以内であること

### 異常系 (Post Not Found)
- [ ] **Given** 存在しない投稿IDがある
      **When** クローラーとして投稿詳細ページURLにアクセスする
      **Then** 404ステータスが返される

### 異常系 (OGP Image Not Found)
- [ ] **Given** OGP画像が生成されていない投稿IDがある
      **When** クローラーとして投稿詳細ページURLにアクセスする
      **Then** `og:image` に `/ogp/default.png` が設定されたHTMLが返される

### 異常系 (DynamoDB Failure)
- [ ] **Given** DynamoDBがダウンしている状態
      **When** クローラーとして投稿詳細ページURLにアクセスする
      **Then** オリジン（S3）のHTMLが返される
      **And** 通常のReactアプリケーションがロードされる

---

## 🔗 関連資料
- `docs/epics.md` (E10)
- AWS Lambda@Edge Documentation
- OGP Protocol Specification (https://ogp.me/)

---

**レビュアーへの確認事項:**
- [ ] 対象とするクローラーのリストは十分か
- [ ] Lambda@Edgeのコストとパフォーマンスへの影響は許容範囲内か
- [ ] OGP画像のURL生成ロジックは正しいか
- [ ] エラーハンドリングの方針は適切か
- [ ] キャッシュ戦略（TTL: 1時間）は適切か
- [ ] レート制限不要の方針でよいか（User-Agent偽装への対策としてWAFを使用）
