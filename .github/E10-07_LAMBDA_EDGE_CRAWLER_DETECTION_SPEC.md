---
name: E10-07 Lambda@Edge Crawler Detection
about: Lambda@Edgeによるクローラー判定・OGP HTML配信（TDD準拠）
title: '[SPEC] E10-07 Lambda@Edge Crawler Detection'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

Lambda@EdgeでUser-Agentを判定し、クローラーにはOGP HTMLを、通常ユーザーにはSPAを返却する。

## 🎯 目的

- SNSクローラー（Twitterbot, facebookexternalhit等）にOGPメタタグを提供する
- 通常ユーザーにはSPA（React）を提供する
- 単一のエンドポイントで両方のユーザーをサポートする

## 📝 詳細仕様

### 機能要件

1. **クローラーUser-Agent判定**
   - Twitterbot, facebookexternalhit, LinkedInBot, Googlebot等を検出
   - User-Agentの小文字変換・部分一致で判定

2. **レスポンス制御**
   - クローラー: OGP HTML（`Content-Type: text/html`）
   - 通常ユーザー: SPA（`Content-Type: text/html`、JavaScriptリダイレクト）

3. **Lambda@Edgeトリガー**
   - Viewer Request: リクエスト時の判定
   - Viewer Response: レスポンスヘッダーの制御

### 非機能要件

- レイテンシへの影響を最小限に抑える（< 50ms）

## 🔧 技術仕様

### クローラーUser-Agentリスト

```javascript
const CRAWLER_USER_AGENTS = [
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'googlebot',
  'baiduspider',
  'facebot',
  'ia_archiver',
  'skypeuripreview'
].map(ua => ua.toLowerCase());
```

### Lambda@Edgeハンドラー

```javascript
// infrastructure/lambda_edge/ogp_handler.js
'use strict';

// クローラーUser-Agentのリスト
const CRAWLER_USER_AGENTS = [
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'googlebot',
  'baiduspider',
  'facebot',
  'ia_archiver',
  'skypeuripreview'
];

/**
 * クローラー判定関数
 * @param {Object} headers - リクエストヘッダー
 * @return {Boolean} クローラーならtrue
 */
function isCrawler(headers) {
  const userAgent = headers['user-agent'] && headers['user-agent'][0] ? headers['user-agent'][0].value.toLowerCase() : '';
  return CRAWLER_USER_AGENTS.some(crawlerUA => userAgent.includes(crawlerUA));
}

/**
 * Lambda@Edgeハンドラー
 * クローラーにはOGP HTMLを、通常ユーザーにはSPAを返す
 */
exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;

  // クローラー判定
  if (isCrawler(request.headers)) {
    // クローラーにはOGP HTMLを返すためのレスポンスを作成
    // 注: viewer-requestイベントではオリジンレスポンスがまだ存在しないため、
    // リクエストを変更してオリジンからOGP HTMLを取得するように設定
    request.uri = '/ogp/index.html';  // OGP HTML用のパスに変更
    callback(null, request);
    // 通常ユーザーにはSPAを返す（リクエストをそのまま通す）
    callback(null, request);
  }
};

/**
 * テスト用にisCrawlerをエクスポート
 */
exports.isCrawler = isCrawler;
```

### Terraform設定（追加）

```hcl
# backend/terraform/cloudfront.tf（追加分）

# Lambda@Edge関数
resource "aws_lambda_function" "ogp_handler" {
  filename         = "${path.module}/lambda_edge/ogp_handler.js"
  function_name    = "aruaruarena-ogp-handler-${var.environment}"
  role            = aws_iam_role.lambda_edge.arn
  handler         = "ogp_handler.handler"
  runtime         = "nodejs18.x"
  publish         = true

  tags = {
    Name        = "aruaruarena-ogp-handler"
    Environment = var.environment
  }
}

# CloudFrontにLambda@Edgeを関連付ける
resource "aws_cloudfront_distribution" "main_with_lambda" {
  # ... 既存の設定

  # Lambda@Edge関連付
  default_cache_behavior {
    # ... 既存の設定
    lambda_function_association {
      event_type   = "viewer-request"
      lambda_arn   = aws_lambda_function.ogp_handler.qualified_arn
      include_body = false
    }
  }
}
```

## 🧪 テスト計画 (TDD)

### Lambda@Edge Test

```javascript
// test/lambda_edge/ogp_handler_spec.js
const { handler, isCrawler } = require('../../infrastructure/lambda_edge/ogp_handler');

describe('ogp_handler', () => {
  describe('クローラー判定', () => {
    it('Twitterbot User-Agentを検出できること', () => {
      const headers = {
        'user-agent': [{ value: 'Twitterbot/1.0' }]
      };
      expect(isCrawler(headers)).toBe(true);
    });

    it('facebookexternalhit User-Agentを検出できること', () => {
      const headers = {
        'user-agent': [{ value: 'facebookexternalhit/1.1' }]
      };
      expect(isCrawler(headers)).toBe(true);
    });

    it('Googlebot User-Agentを検出できること', () => {
      const headers = {
        'user-agent': [{ value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }]
      };
      expect(isCrawler(headers)).toBe(true);
    });

    it('通常ユーザーはクローラーでないと判定されること', () => {
      const headers = {
        'user-agent': [{ value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }]
      };
      expect(isCrawler(headers)).toBe(false);
    });

    it('User-Agentがない場合はクローラーでないと判定されること', () => {
      const headers = {};
      expect(isCrawler(headers)).toBe(false);
    });
  });

  describe('ハンドラー動作', () => {
    it('クローラーからのリクエストでコールバックが呼ばれること', (done) => {
      const event = {
        Records: [{
          cf: {
            request: {
              uri: '/some/path',
              headers: {
                'user-agent': [{ value: 'Twitterbot/1.0' }]
              }
            },
            response: {
              headers: {
                'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }]
              }
            }
          }
        }]
      };

      const callback = (error, result) => {
        expect(error).toBeNull();
        expect(result).toBeDefined();
        expect(result.uri).toBe('/ogp/index.html');
        done();
      };

      handler(event, {}, callback);
    });

    it('通常ユーザーからのリクエストでコールバックが呼ばれること', (done) => {
      const event = {
        Records: [{
          cf: {
            request: {
              uri: '/some/path',
              headers: {
                'user-agent': [{ value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }]
              }
            },
            response: {
              headers: {
                'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }]
              }
            }
          }
        }]
      };

      const callback = (error, result) => {
        expect(error).toBeNull();
        expect(result).toBeDefined();
        expect(result.uri).toBe('/some/path');
        done();
      };

      handler(event, {}, callback);
    });
  });
});
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: Twitterbot User-Agentでリクエストする
- **When**: Lambda@Edgeハンドラーを実行する
- **Then**: request.uriが'/ogp/index.html'に変更される
- **And**: オリジンからOGP HTMLが返される
- **And**: レスポンスにOGPメタタグが含まれている

- **Given**: 通常ブラウザUser-Agentでリクエストする
- **When**: Lambda@Edgeハンドラーを実行する
- **Then**: request.uriが変更されない
- **And**: オリジンから通常のSPAが返される

### 異常系 (Error Path)

- **Given**: User-Agentがないリクエスト
- **When**: Lambda@Edgeハンドラーを実行する
- **Then**: 通常ユーザーとして処理される

## 🔗 関連資料

- `backend/infrastructure/lambda_edge/ogp_handler.js`: 新規作成ファイル
- `backend/terraform/cloudfront.tf`: CloudFront・Lambda@Edge設定
- `backend/app/views/ogp/show.html.erb`: OGPメタタグHTMLテンプレート

## レビュアーへの確認事項

- [ ] クローラーUser-Agentリストが適切に定義されている
- [ ] 小文字変換・部分一致で判定されている
- [ ] Lambda@Edgeハンドラーが正しく実装されている
- [ ] viewer-requestイベントでトリガーされている
- [ ] Terraform設定が正しく記述されている
- [ ] Lambda@Edgeテストがすべて通過している
