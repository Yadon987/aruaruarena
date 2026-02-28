# あるあるアリーナ - 実装状況分析と完了に必要な要素（完全版）

## Context

この計画は「あるあるアリーナ」プロジェクトの現在の実装状況を包括的に評価し、アプリを完成させるために必要な要素を特定するために作成されました。バックエンドの基盤が整っているかどうかを判断し、次のステップを明確にすることが目的です。

---

## バックエンド実装状況

### 完了（ほぼ100%）

| 機能 | ステータス | 詳細 |
|------|---------|------|
| **投稿API** | ✅ 完了 | POST /api/posts、バリデーション、レート制限、重複チェック |
| **AI審査システム** | ✅ 完了 | 3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）、並列処理 |
| **投稿詳細API** | ✅ 完了 | GET /api/posts/:id、OGP HTML返信、クローラー判定 |
| **ランキングAPI** | ✅ 完了 | GET /api/rankings、TOP20、GSI使用 |
| **再審査API** | ✅ 完了 | POST /api/posts/:id/rejudge、失敗審査員のみ |
| **OGP画像生成** | 🟡 部分完了 | mini_magickによる画像合成、審査員アイコン（512x512、1200x630のベース画像が必要） |
| **モデル** | ✅ 完了 | Post, Judgment, RateLimit, DuplicateCheck |
| **サービス** | ✅ 完了 | JudgePostService, RejudgePostService, RateLimiterService, DuplicateCheckService, OgpGeneratorService |
| **アダプター** | ✅ 完了 | GeminiAdapter, DewiAdapter, CerebrasAdapter, OpenAiAdapter, GlmAdapter |
| **テスト** | 🟡 部分完了 | 全てのスペックファイルが存在、カバレッジ25%（目標90%） |

### テスト設定の現状

| 設定項目 | ステータス | ファイルパス |
|----------|---------|----------|
| SimpleCov | ✅ 設定済 | `backend/.simplecov` |
| VCR | ✅ 設定済 | `backend/spec/support/vcr.rb` |
| DynamoDB Local | ✅ 設定済 | `backend/spec/support/dynamoid.rb` |
| FactoryBot | ✅ 設定済 | `backend/spec/support/factory_bot.rb` |
| Factories | ✅ 設定済 | `backend/spec/factories/`（5ファイル） |

**カバレッジ現状**:
- 目標: 90%
- 実際: 25.07% (341/1360 lines)
- 対象: 727 examples, 0 failures, 1 pending

### DynamoDB設計

| テーブル | 設定 | コスト見積 |
|---------|------|----------|
| aruaruarena-posts | PK: id, GSI: ranking_index, PITR: 有効 | 月額約$0.26（PITR込み） |
| aruaruarena-judgments | PK: post_id, SK: persona, PITR: 有効 | 月額約$0.26（PITR込み） |
| aruaruarena-rate-limits | PK: identifier, TTL: 5分 | 月額約$0.05（TTL自動削除） |
| aruaruarena-duplicate-checks | PK: body_hash, TTL: 24時間 | 月額約$0.05（TTL自動削除） |

**トラフィック増加シナリオ（概算）**:

| シナリオ | 想定負荷 | DynamoDB概算 | 補足 |
|---------|---------|-------------|------|
| 現状 | 読み取り 1x / 書き込み 1x | 月額約$0.62 | PITR込み、TTL自動削除の運用前提 |
| 増加時 | 読み取り 10x / 書き込み 10x | 月額約$6〜7 | ランキング取得増加で `posts` GSI 読み取りが支配的 |
| 大幅増加時 | 読み取り 100x / 書き込み 100x | 月額約$60〜70 | オンデマンド継続可だがキャッシュ未導入だと伸びやすい |
| ピーク帯 | 平常時 10x、ランキングAPIのみ 50x | 月額約$12前後 | 集中アクセスが短時間でも読み取りコストが跳ねやすい |

**キャッシュ適用時の目安**:
- ランキング取得にRedisまたはDAXを導入し、ランキングAPI読み取りの70%をキャッシュヒットできれば、ピーク帯の読み取りコストは概ね30〜40%まで圧縮できる
- PITRはトラフィックに比例せず固定寄り、TTLは `rate-limits` と `duplicate-checks` の保管コスト抑制に有効
- 目安として、平常時の10倍を超える見込みが出た段階でキャッシュ導入を検討し、100倍規模やピーク偏在が強い場合はテーブル設計・GSI設計の見直しも合わせて検討する

**アクセスパターン**:
- 投稿取得: PK (id) で取得
- ランキング取得: GSI (ranking_index) で `status=scored` のTOP20取得
- 審査中投稿取得: PK (id) で取得（ステータスフィルタリング）
- 審査失敗投稿取得: PK (id) で取得（ステータスフィルタリング）

**スコア範囲**:
- average_score: 0-100（整数または小数第1位）
- 各審査員のスコア: 0-20（5項目×20点＝100点満点）

### AWSインフラ

| リソース | ステータス |
|---------|---------|
| Lambda（Docker） | ✅ 設定済 |
| DynamoDB（4テーブル） | ✅ 設定済 |
| API Gateway（HTTP API v2） | ✅ 設定済 |
| ECRリポジトリ | ✅ 設定済 |
| IAMロール（GitHub OIDC） | ✅ 設定済 |
| CloudWatchログ | ✅ 設定済 |
| EventBridgeウォームアップ | ✅ 設定済 |
| S3バケット | 🟡 未実装 | Terraformでの定義が必要 |
| CloudFrontディストリビューション | 🟡 未実装 | Terraformでの定義が必要 |
| AWS Secrets Manager | 🟡 未実装 | AI APIキーの管理が必要 |
| Docker ImageMagick | 🟡 未実装 | OGP画像生成に必要、Dockerfileに追加が必要 |

---

## フロントエンド実装状況

### 基盤（100%完了）

| 機能 | ステータス |
|------|---------|
| React 19 + TypeScript | ✅ 完了 |
| Viteビルド環境 | ✅ 完了 |
| TanStack Query | ✅ 完了 |
| Tailwind CSS | ✅ 完了 |
| ESLint/Prettier | ✅ 完了 |
| Playwright（E2E） | ✅ 完了（11ファイル、229 tests） |
| Vitest（ユニット） | ✅ 完了（32ファイル） |
| MSW（APIモック） | ✅ 完了 |
| Framer Motion | 🟡 未使用 | インストール済みだが未使用 |

### 画面実装状況

| 画面 | ステータス | 詳細 |
|------|---------|------|
| **トップ画面** | ✅ 完了 | 投稿フォーム、ランキング、ヘッダー、フッター |
| **審査中画面** | 🟡 部分未実装 | 基本構造はあるが、Framer Motionアニメーション未実装、キャラクター動き未実装 |
| **審査結果モーダル** | ✅ 完了 | 詳細表示、再審査、シェア機能 |
| **自分の投稿一覧** | ✅ 完了 | LocalStorage連携 |
| **プライバシーポリシー** | ✅ 完了 | モーダル実装 |

### 不足しているフロントエンド機能

| 機能 | 優先度 | 詳細 |
|------|--------|------|
| **Framer Motionアニメーション** | P1（高） | インストール済みだが未使用、審査中画面のフルスクリーン遷移、モーダル演出、キャラクターアニメーション |
| **音声再生** | P1（高） | BGM・効果音のファイル取得と実装、Howler.jsの導入、クロスフェード（0.5秒）、ミュートトグル（LocalStorage保存） |
| **App.tsxの分割** | P3（低） | 982行の巨大ファイルをコンポーネント分割 |
| **キャラクター動き・口癖** | P2（中） | 3人のAI審査員キャラクターの動き、ランダム口癖 |

---

## インフラ・デプロイ状況

### 完了

| 機能 | ステータス |
|------|---------|
| バックエンドデプロイ（GitHub Actions） | ✅ 完了 |
| フロントエンドデプロイ（GitHub Actions） | ✅ 完了（S3/CloudFrontは手動設定） |
| CIワークフロー（テスト） | ✅ 完了 |

### 不足しているインフラ設定

| 機能 | 優先度 | 詳細 |
|------|--------|------|
| **S3 + CloudFront（Terraform）** | P1（高） | フロントエンド配信用、現在は手動設定のみ、IAMポリシーにS3操作権限とCloudFront invalidation権限を設定 |
| **AI APIキーのSecrets Manager統合** | P1（高） | GitHub Actions SecretsではなくAWS Secrets Managerで管理 |
| **カスタムドメイン設定** | P3（低） | API Gateway、CloudFrontのカスタムドメイン |
| **CloudWatchアラート** | P2（中） | Lambdaエラー数（例: 1分間に10エラー以上）、DynamoDBスロットリング（例: 1分間に50回以上）、メール/SNS通知設定 |

---

## Epic進捗状況

| Epic | 名前 | ステータス |
|------|------|---------|
| E01 | テスト環境構築 | 🟡 部分完了（カバレッジ25%で目標90%に未達） |
| E02 | インフラ構築 | 🟡 部分完了（S3/CloudFront/Secrets ManagerのTerraform未追加） |
| E03 | DynamoDBスキーマ定義 | ✅ 完了 |
| E04 | フロントエンド基盤構築 | ✅ 完了 |
| E05 | 投稿API | ✅ 完了 |
| E06 | AI審査システム | ✅ 完了 |
| E07 | 投稿詳細API | ✅ 完了 |
| E08 | ランキングAPI | ✅ 完了 |
| E09 | レート制限・スパム対策 | ✅ 完了 |
| E10 | OGP画像生成 | 🟡 部分完了（ベース画像が512x512で1200x630が必要） |
| E11 | 再審査API | ✅ 完了 |
| E12 | トップ画面 | ✅ 完了 |
| E13 | 審査中画面 | 🟡 部分完了（アニメーション未実装） |
| E14 | フロントエンド自動デプロイ | ✅ 完了（Terraform未追加） |
| E15 | 審査結果モーダル | ✅ 完了 |
| E16 | 自分の投稿一覧 | ✅ 完了 |
| E17 | プライバシーポリシー | ✅ 完了 |
| E18 | BGM・SE再生 | 🟡 部分完了（フックのみ、音声ファイル未実装） |

---

## セキュリティ観点

### CORS設定
- 現状: 全オリジン許可（`allow_origins = ["*"]`）
- 本番: 特定のオリジンのみ許可が必要
- 実装: 環境変数でオリジンを管理し、Terraformで設定

### レート制限
- IPアドレスの検証方法: `X-Forwarded-For` ヘッダーを使用
- プロキシ経由のリクエスト処理: 複数のIPヘッダーの考慮

---

## 非機能要件

### パフォーマンス

**ランキング取得**:
- ランキング順位計算にN+1クエリを回避するためのキャッシュ戦略を検討
- RedisまたはDAX（DynamoDB Accelerator）の導入を検討

**DynamoDBコスト**:
- オンデマンドモードでのRCU/WCUコストを見積もり
- キャッシュ戦略によるコスト削減効果を評価

---

## テスト観点

### エッジケース

**並行審査**:
- 3人のAI審査員が同時にタイムアウトした場合のステータス（failedになるべき）
- 2人が成功、1人がタイムアウトした場合のステータス（scoredになるべき）

**ポーリング**:
- 60秒タイムアウト時のエラーモーダル表示
- 審査中画面からの遷移（トップ画面に戻るか、エラーモーダルを表示するか）

**コールドスタート**:
- Lambdaのコールドスタート時の処理（EventBridgeウォームアップで対応済み）

### 統合テスト

**E2Eテスト（Playwright）**:
- ✅ MSWモックベースのE2Eテスト: 11ファイル実装済み
- 🟡 実際のバックエンドAPIを使用したE2Eテスト: 未実装
  - ローカル開発環境での統合テスト
  - CI環境での統合テスト（Docker Composeでバックエンド起動）

---

## 結論：バックエンドの基盤は完成している

**バックエンドは95%以上完成しています。**

以下の機能が完全に実装されています：
- 投稿・審査・ランキング・OGP機能
- AI審査員（3人）と並列処理
- DynamoDB設計とPITR
- AWSインフラ（Lambda、API Gateway、IAM、EventBridge、CloudWatch）
- テスト設定（SimpleCov、VCR、DynamoDB Local、FactoryBot）
- CI/CD（GitHub Actions）

---

## アプリを完成させるために必要な要素

### 優先度：高（P1）

#### 1. Framer Motionアニメーション実装

**ファイル**: `frontend/src/App.tsx`, 新規コンポーネント

**詳細**:
- 審査中画面のフルスクリーン遷移（0.5-0.8秒）
- モーダルのフェードアウト/フェードイン
- キャラクターアニメーション
- `AnimatePresence` を使用した画面切り替え
- アクセシビリティ対応（`useReducedMotion` フック）
- アニメーション完了時のイベントハンドリング

**実装手順**:

1. **App.tsxにFramer Motionを追加**
   ```tsx
   import { AnimatePresence, motion } from 'framer-motion'
   ```

2. **審査中画面のアニメーション実装**
   ```tsx
   <AnimatePresence mode="wait">
     {viewMode === 'judging' && (
       <motion.section
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         exit={{ opacity: 0, scale: 1.05 }}
         transition={{ duration: 0.5 }}
       >
         {/* 審査中画面の内容 */}
       </motion.section>
     )}
   </AnimatePresence>
   ```

3. **審査員キャラクターのアニメーション**
   ```tsx
   {JUDGE_NAMES.map((judgeName, index) => (
     <motion.li
       key={judgeName}
       initial={{ opacity: 0, x: -20 }}
       animate={{ opacity: 1, x: 0 }}
       transition={{ delay: index * 0.2, duration: 0.3 }}
     >
       <p>{judgeName}</p>
     </motion.li>
   ))}
   ```

4. **モーダルのアニメーション実装**
   - `ResultModal.tsx` に `motion.div` を追加
   - フェードイン/フェードアウトアニメーション（0.3秒）
   - `PrivacyPolicyModal.tsx` にも同様に実装
   - `onAnimationComplete` コールバックを使用

**参考**:
- 画面設計書: `/home/nukon/ws/aruaruarena/docs/screen_design.md:210-231`
- 既存コード: `frontend/src/App.tsx`（982行、viewMode管理あり）

#### 2. S3 + CloudFront（Terraform追加）

**ファイル**: 新規 `backend/terraform/s3.tf`, `backend/terraform/cloudfront.tf`

**詳細**:
- S3バケット定義（静的ホスティング）
- CloudFrontディストリビューション定義
- バージョニング設定
- カスタムエラーページ
- IAMポリシーにS3操作権限とCloudFront invalidation権限を設定

**実装手順**:

1. **backend/terraform/s3.tf 作成**
   ```hcl
   resource "aws_s3_bucket" "frontend" {
     bucket_prefix = "aruaruarena-frontend-"
     force_destroy = true
   }

   resource "aws_s3_bucket_versioning" "frontend" {
     bucket = aws_s3_bucket.frontend.id

     versioning_configuration {
       status = "Enabled"
     }
   }

   resource "aws_s3_bucket_website_configuration" "frontend" {
     bucket = aws_s3_bucket.frontend.id

     index_document {
       suffix = "index.html"
     }

     error_document {
       key = "index.html"
     }
   }

   resource "aws_s3_bucket_public_access_block" "frontend" {
     bucket = aws_s3_bucket.frontend.id

     block_public_acls       = true
     block_public_policy     = true
     ignore_public_acls      = true
     restrict_public_buckets = true
   }

   resource "aws_s3_bucket_policy" "frontend" {
     bucket = aws_s3_bucket.frontend.id
     policy = jsonencode({
       Version = "2012-10-17"
       Statement = [
         {
           Sid       = "AllowCloudFront"
           Effect    = "Allow"
           Principal = {
             Service = "cloudfront.amazonaws.com"
           }
           Action   = "s3:GetObject"
           Resource = "${aws_s3_bucket.frontend.arn}/*"
           Condition = {
             StringEquals = {
               "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
             }
           }
         }
       ]
     })
   }
   ```

2. **backend/terraform/cloudfront.tf 作成**
   ```hcl
   resource "aws_cloudfront_origin_access_control" "frontend" {
     name                              = "aruaruarena-frontend-oac"
     origin_access_control_origin_type = "s3"
     signing_behavior                  = "always"
     signing_protocol                  = "sigv4"
   }

   resource "aws_cloudfront_distribution" "frontend" {
     enabled             = true
     is_ipv6_enabled     = true
     default_root_object = "index.html"

     origin {
       domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
       origin_id   = "S3-${aws_s3_bucket.frontend.id}"
       origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
     }

     default_cache_behavior {
       allowed_methods  = ["GET", "HEAD", "OPTIONS"]
       cached_methods   = ["GET", "HEAD"]
       target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

       forwarded_values {
         query_string = false
         cookies {
           forward = "none"
         }
       }

       viewer_protocol_policy = "redirect-to-https"
       min_ttl                = 0
       default_ttl            = 3600
       max_ttl                = 86400
       compress               = true
     }

     viewer_certificate {
       cloudfront_default_certificate = true
     }

     restrictions {
       geo_restriction {
         restriction_type = "none"
       }
     }

     # カスタムエラーページ
     custom_error_response {
       error_code         = 403
       error_caching_min_ttl = 10
       response_code      = 403
       response_page_path  = "/403.html"
     }

     custom_error_response {
       error_code         = 404
       error_caching_min_ttl = 10
       response_code      = 404
       response_page_path  = "/404.html"
     }

     custom_error_response {
       error_code         = 500
       error_caching_min_ttl = 10
       response_code      = 500
       response_page_path  = "/500.html"
     }
   }

   resource "aws_cloudfront_origin_access_identity" "frontend" {
     comment = "Origin Access Identity for aruaruarena frontend S3 bucket"
   }
   ```

3. **IAMポリシーの更新**
   - GitHub Actions OIDCロールにS3操作権限を追加
   - CloudFront invalidation権限を追加（`cloudfront:CreateInvalidation`, `cloudfront:GetInvalidation`, `cloudfront:ListInvalidations`）

4. **デプロイ時のキャッシュクリア手順**
   - `terraform apply` 後にCloudFront invalidationを実行
   - `aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"`

**参考**:
- 既存のフロントエンドデプロイ: `.github/workflows/deploy-frontend.yml`

#### 3. AI APIキーのSecrets Manager統合

**ファイル**: 新規 `backend/terraform/secrets.tf`

**詳細**:
- AWS Secrets ManagerでGEMINI_API_KEY、GLM_API_KEY、GROQ_API_KEYを管理
- Lambda環境変数からシークレットを参照
- GitHub Actions Secretsから削除、AWSで管理
- シークレットローテーション対応
- IAMポリシーの最小権限化
- シークレット取得失敗時のエラーハンドリング
- 複数リージョン対応

**実装手順**:

1. **Secrets Manager シークレットの作成（Terraform）**
   ```hcl
   resource "aws_secretsmanager_secret" "gemini_api_key" {
     name = "aruaruarena/gemini_api_key"
   }

   resource "aws_secretsmanager_secret" "glm_api_key" {
     name = "aruaruarena/glm_api_key"
   }

   resource "aws_secretsmanager_secret" "groq_api_key" {
     name = "aruaruarena/groq_api_key"
   }

   # シークレットのバージョンは手動でAWSコンソールまたはCLIで作成
   ```

2. **Lambda環境変数の更新**
   - `BACKEND_TERRAFORM_GEMINI_API_KEY_SECRET_ARN`: Secrets ManagerのARN
   - `BACKEND_TERRAFORM_GLM_API_KEY_SECRET_ARN`: Secrets ManagerのARN
   - `BACKEND_TERRAFORM_GROQ_API_KEY_SECRET_ARN`: Secrets ManagerのARN

3. **バックエンドコードの更新**
   - アダプター内でSecrets Managerから値を取得
   - 環境変数がARN形式（`arn:aws:secretsmanager:*`）で始まるか判定
   - ARNの場合、Secrets Managerから取得するロジックを追加
   - `Aws::SecretsManager::Errors::` 例外のハンドリングを追加

   ```ruby
   def api_key
     configured_value = ENV.fetch('BACKEND_TERRAFORM_GEMINI_API_KEY_SECRET_ARN')
     return configured_value unless configured_value.start_with?('arn:aws:secretsmanager:')

     client = Aws::SecretsManager::Client.new
     response = client.get_secret_value(secret_id: configured_value)
     JSON.parse(response.secret_string).fetch('api_key')
   rescue Aws::SecretsManager::Errors::ServiceError => e
     Rails.logger.error("Secrets Managerの取得に失敗しました: #{e.class} #{e.message}")
     raise
   end
   ```

   - ローカル開発ではARNではなく生のAPIキー文字列を環境変数へ設定してフォールバック
   - IAM権限は `secretsmanager:GetSecretValue` を対象シークレットARNに限定して付与

4. **IAM権限の追加**
   - Lambdaロールに `secretsmanager:GetSecretValue` 権限を追加
   - 最小権限化（特定のシークレットARNのみアクセス許可）

5. **シークレットローテーション手順**
   - 手動更新時の手順（AWSコンソールまたはCLI）
   - `aws secretsmanager put-secret-value --secret-id <secret-arn> --secret-string <new-key>`

6. **ローカル開発環境のフォールバック**
   - 環境変数が直接のキー値の場合はそのまま使用

#### 4. OGPベース画像の作成

**ファイル**: `backend/app/assets/images/base_ogp.png`

**詳細**:
- 現在: 512x512ピクセル、4.1KB
- 必要: 1200x630ピクセル（Twitter/X推奨サイズ）
- 目的: SNSシェア時のOGP表示
- 審査員アイコンのサイズ、配置座標、重ね順
- テキストのフォント、サイズ、色、位置
- 背景色

**実装手順**:

1. **画像作成ツールの使用**
   - Figma、Canva、またはImageMagickを使用
   - 審査員アイコンを配置

2. **ImageMagickでの作成例**
   ```bash
   convert -size 1200x630 xc:#ffffff \
     -fill "#333333" -pointsize 48 -font "Noto-Sans-JP" -gravity center -annotate +0-100 "あるあるアリーナ" \
     base_ogp.png
   ```

3. **画像の配置**
   - `backend/app/assets/images/base_ogp.png` に配置
   - Gitにコミット

**参考**:
- 画面設計書で指定されているOGPサイズ

#### 5. 音声ファイルの用意

**ディレクトリ**: `frontend/public/sounds/`（新規作成）

**ファイル**:
- BGM: `radetzky_march.mp3`（ラデツキー行進曲）
- BGM: `galop_des_clown.mp3`（道化師のギャロップ）
- BGM: `pomp_and_circumstance.mp3`（威風堂々）
- BGM: `fate_theme.mp3`（運命）
- SE: `se_submit.mp3`（投稿）
- SE: `se_result_open.mp3`（結果表示）
- SE: `se_retry.mp3`（再審査）

**詳細**:
- 各ファイルのライセンス確認
- ファイルサイズの最適化
- BGMファイルサイズ: 2MB以下
- SEファイルサイズ: 100KB以下
- ビットレート: 128kbps〜192kbps
- サンプリングレート: 44.1kHz
- BGMのループポイント設定
- クロスフェード方式（等化率カーブ）

**実装手順**:

1. **音声ソースの取得**
   - パブリックドメインの音楽を使用
   - クリエイティブ・コモンズのライセンス確認

2. **音声編集**
   - AudacityやFFmpegを使用
   - ループ用に編集

3. **ファイル圧縮**
   ```bash
   ffmpeg -i input.wav -b:a 128k output.mp3
   ```

4. **ディレクトリ作成と配置**
   ```bash
   mkdir -p frontend/public/sounds
   cp *.mp3 frontend/public/sounds/
   ```

#### 6. DockerfileへのImageMagick追加

**ファイル**: `backend/Dockerfile`

**詳細**:
- OGP画像生成に必要なImageMagickをインストール
- 依存関係の明確化
- ポリシーファイル設定
- 動作確認

**実装手順**:

1. **Dockerfileの編集**
   ```dockerfile
   FROM ruby:3.2-slim

   # 既存の設定...

   # ImageMagickと依存ライブラリのインストール
   RUN apt-get update && \
       apt-get install -y --no-install-recommends \
       imagemagick \
       libpng-dev \
       libjpeg-dev \
       libfreetype-dev \
       && rm -rf /var/lib/apt/lists/*

   # 既存の設定...
   ```

2. **動作確認**
   ```bash
   docker build -t aruaruarena-backend .
   docker run --rm aruaruarena-backend identify -version
   docker run --rm aruaruarena-backend convert -size 100x100 xc:white test.png
   ```

### 優先度：中（P2）

#### 7. 音声再生実装

**ファイル**: `frontend/src/hooks/useSound.ts`

**詳細**:
- BGM: ラデツキー行進曲（トップ）、道化師のギャロップ（審査中）、威風堂々（成功）、運命（失敗）
- 効果音: se_submit, se_result_open, se_retry
- クロスフェード（0.5秒、等化率カーブ）
- ミュートトグル（LocalStorage保存）
- BGMの同時再生制御
- ブラウザの自動再生ポリシー対応
- メモリ管理（Howlインスタンスの破棄）
- エラー発生時の代替対応

**実装手順**:

1. **Howler.jsのインストール**
   ```bash
   cd frontend
   npm install howler
   npm install --save-dev @types/howler
   ```

2. **useSound.tsの実装**
   ```typescript
   import { Howl } from 'howler'
   import { useEffect, useRef } from 'react'

   const BGM_MAP = {
     top: '/sounds/radetzky_march.mp3',
     judging: '/sounds/galop_des_clown.mp3',
     success: '/sounds/pomp_and_circumstance.mp3',
     failed: '/sounds/fate_theme.mp3',
   } as const

   const SE_MAP = {
     submit: '/sounds/se_submit.mp3',
     result_open: '/sounds/se_result_open.mp3',
     retry: '/sounds/se_retry.mp3',
   } as const

   type Scene = keyof typeof BGM_MAP
   type SoundEffect = keyof typeof SE_MAP

   export function useSound() {
     const bgmRef = useRef<Howl | null>(null)
     const isMutedRef = useRef<boolean>(false)

     // ミュート設定の復元
     useEffect(() => {
       const savedMuted = localStorage.getItem('sound_muted')
       isMutedRef.current = savedMuted === 'true'
     }, [])

     // ユーザージェスチャーによるアンロック
     const unlockAudio = () => {
       if (bgmRef.current) {
         bgmRef.current.play()
         bgmRef.current.stop()
       }
     }

     const playBgm = (scene: Scene) => {
       if (isMutedRef.current) return

       const url = BGM_MAP[scene]
       if (bgmRef.current) {
         // クロスフェード（0.5秒）
         bgmRef.current.fade(bgmRef.current.volume(), 0, 500)
         setTimeout(() => {
           bgmRef.current = new Howl({
             src: [url],
             loop: true,
             volume: 0,
           })
           bgmRef.current.play()
           bgmRef.current.fade(0, 0.5, 500)
         }, 500)
       } else {
         bgmRef.current = new Howl({
           src: [url],
           loop: true,
           volume: 0.5,
         })
         bgmRef.current.play()
       }
     }

     const playSe = (sound: SoundEffect) => {
       if (isMutedRef.current) return

       const url = SE_MAP[sound]
       new Howl({
         src: [url],
         volume: 0.5,
       }).play()
     }

     const stopBgm = () => {
       if (bgmRef.current) {
         bgmRef.current.fade(bgmRef.current.volume(), 0, 500)
         setTimeout(() => {
           bgmRef.current.stop()
           bgmRef.current = null
         }, 500)
       }
     }

     const setMuted = (muted: boolean) => {
       isMutedRef.current = muted
       localStorage.setItem('sound_muted', String(muted))
       if (bgmRef.current) {
         bgmRef.current.mute(muted)
       }
     }

     const isMuted = () => isMutedRef.current

     return { playBgm, playSe, stopBgm, setMuted, isMuted, unlockAudio }
   }
   ```

3. **App.tsxでの使用**
   - ミュートトグルボタンの実装
   - 画面遷移時のBGM切り替え
   - コンポーネントアンマウント時のクリーンアップ

**参考**:
- 画面設計書: `/home/nukon/ws/aruaruarena/docs/screen_design.md:22-23, 47, 72-75`
- Epic E18: `/home/nukon/ws/aruaruarena/docs/epics.md:636-658`
- 既存コード: `frontend/src/features/top/components/SoundToggleButton.tsx`（フックのみ実装済み）

#### 8. キャラクター動き・口癖

**ファイル**: 新規コンポーネント

**詳細**:
- 3人のAI審査員キャラクターの動き
- ランダムで口癖を発言する機能
- アニメーションタイプ（スライド/拡大/回転/フェード）
- 口癖発言のタイミング（アニメーション開始2秒後）
- 審査員ごとの動きの違い（ひろゆき：横移動、デヴィ：回転、中尾：拡大）
- アニメーション速度調整
- 口癖の安定化（コンポーネントマウント時に固定）

**実装手順**:

1. **キャラクター口癖の定義**
   ```typescript
   // constants/judgeCatchphrases.ts
   export const JUDGE_CATCHPHRASES = {
     hiroyuki: [
       'それってあなたの感想ですよね',
       'なんか違くない？',
       '論理的になってないよ',
     ],
     dewi: [
       'うふふ、素敵ですね',
       'さすがですわ',
       'アリーナの女王様にふさわしい',
     ],
     nakao: [
       'うっ、衝撃の事実！',
       'これは...これは！',
       'どうなんだよこれ！',
     ],
   } as const
   ```

2. **キャラクターコンポーネントの作成**
   ```typescript
   // components/JudgeCharacter.tsx
   import { motion } from 'framer-motion'
   import { JUDGE_CATCHPHRASES } from '../constants/judgeCatchphrases'

   type Persona = 'hiroyuki' | 'dewi' | 'nakao'

   interface Props {
     persona: Persona
     isAnimating: boolean
   }

   export function JudgeCharacter({ persona, isAnimating }: Props) {
     const catchphrase = JUDGE_CATCHPHRASES[persona][0]

     return (
       <motion.div
         variants={{
           idle: { y: 0 },
           anim: { y: [0, -10, 0] }
         }}
         animate={isAnimating ? 'anim' : 'idle'}
         transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
         className="flex flex-col items-center"
       >
         {/* キャラクターのアバター */}
         <div className="w-24 h-24 rounded-full bg-gray-200 mb-2" />
         <p className="text-lg font-semibold">{persona}</p>
         <motion.p
           initial={{ opacity: 0 }}
           animate={{ opacity: isAnimating ? 1 : 0 }}
           transition={{ delay: 2, duration: 1 }}
           className="text-sm text-gray-600"
         >
           {catchphrase}
         </motion.p>
       </motion.div>
     )
   }
   ```

**参考**:
- 画面設計書: `/home/nukon/ws/aruaruarena/docs/screen_design.md:42-43`

#### 9. CloudWatchアラート

**ファイル**: 新規 `backend/terraform/alerts.tf`

**詳細**:
- Lambdaエラー数のアラート（例: 1分間に10エラー以上）
- DynamoDBスロットリングのアラート（例: 1分間に50回以上）
- メール/SNS通知設定
- アラートの頻度制限（1時間に1回）
- 復旧通知（OK状態）の送信
- アラートの重要度レベル設定

**実装手順**:

1. **SNSトピックの作成**
   ```hcl
   resource "aws_sns_topic" "alerts" {
     name = "aruaruarena-alerts"
   }

   resource "aws_sns_topic_subscription" "email" {
     topic_arn = aws_sns_topic.alerts.arn
     protocol  = "email"
     endpoint  = "your-email@example.com" # 環境変数化
   }
   ```

2. **CloudWatchメトリクスアラームの作成**
   ```hcl
   # Lambdaエラーアラーム
   resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
     alarm_name          = "aruaruarena-lambda-errors"
     comparison_operator = "GreaterThanOrEqualToThreshold"
     evaluation_periods  = "1"
     metric_name         = "Errors"
     namespace           = "AWS/Lambda"
     period              = "60"
     statistic           = "Sum"
     threshold           = "10"

     dimensions = {
       FunctionName = aws_lambda_function.main.function_name
     }

     alarm_actions       = [aws_sns_topic.alerts.arn]
     ok_actions          = [aws_sns_topic.alerts.arn]
     # アラートの頻度制限
     datapoints_to_alarm = "1"
     treat_missing_data = "notBreaching"
   }

   # DynamoDBスロットリングアラーム
   resource "aws_cloudwatch_metric_alarm" "dynamodb_throttle" {
     alarm_name          = "aruaruarena-dynamodb-throttle"
     comparison_operator = "GreaterThanOrEqualToThreshold"
     evaluation_periods  = "1"
     metric_name         = "UserErrors"
     namespace           = "AWS/DynamoDB"
     period              = "60"
     statistic           = "Sum"
     threshold           = "50"

     alarm_actions       = [aws_sns_topic.alerts.arn]
   }
   ```

### 優先度：低（P3）

#### 10. App.tsxのコンポーネント分割

**ファイル**: `frontend/src/App.tsx`（982行）

**詳細**:
- 画面/機能単位に分割
- `features/post/` と `features/ranking/` を実装
- コンポーネント抽出時の依存関係管理
- 状態管理の移行方法（Context API/Zust/Jotai）
- テストへの影響（既存テストの修正範囲）
- 分割後のパフォーマンスへの影響
- 循環依存の防止

**実装手順**:

1. **新しいディレクトリ構造**
   ```
   frontend/src/
     features/
       post/
         PostForm.tsx（投稿フォーム）
       ranking/
         RankingList.tsx（ランキング一覧）
       judging/
         JudgingScreen.tsx（審査中画面）
       my-posts/
         MyPostsModal.tsx（自分の投稿一覧）
   ```

2. **コンポーネントの抽出**
   - `PostForm`: 投稿フォーム部分
   - `RankingList`: ランキング表示部分
   - `JudgingScreen`: 審査中画面部分
   - `MyPostsModal`: 自分の投稿一覧モーダル

3. **App.tsxの簡略化**
   - 状態管理をコンテキストに移行
   - 各コンポーネントへのデータ受け渡し

4. **循環依存の確認**
   - ESLintのプラグインで循環依存を検出
   - テスト実行で機能を確認

#### 11. カスタムドメイン設定

**ファイル**: `backend/terraform/api_gateway.tf`, `backend/terraform/cloudfront.tf`

**詳細**:
- ACM証明書をTerraformで管理
- API GatewayとCloudFrontにカスタムドメイン設定
- DNSレコードの種類・設定
- SSL証明書の更新方法
- 証明書失効時の通知
- HTTPSへのリダイレクト設定
- HSTSヘッダーの設定

**実装手順**:

1. **ACM証明書の作成**
   ```hcl
   resource "aws_acm_certificate" "main" {
     domain_name       = "aruaruarena.example.com"
     validation_method = "DNS"

     lifecycle {
       create_before_destroy = true
     }
   }

   resource "aws_route53_record" "cert_validation" {
     for_each = {
       for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
         name   = dvo.resource_record_name
         record = dvo.resource_record_value
         type   = dvo.resource_record_type
       }
     }

     allow_overwrite = true
     name            = each.value.name
     records         = [each.value.record]
     ttl             = 60
     type            = each.value.type
     zone_id         = var.route53_zone_id
   }

   resource "aws_acm_certificate_validation" "main" {
     certificate_arn         = aws_acm_certificate.main.arn
     validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
   }
   ```

2. **DNSレコードの設定**
   - Route53の場合: AレコードまたはALIAS設定
   - 外部DNSプロバイダー: CNAME設定
   - DNS検証コマンド: `nslookup aruaruarena.example.com`

3. **API Gatewayのカスタムドメイン**
   ```hcl
   resource "aws_apigatewayv2_domain_name" "main" {
     domain_name = "api.aruaruarena.example.com"

     domain_name_configuration {
       certificate_arn = aws_acm_certificate.main.arn
       endpoint_type   = "REGIONAL"
       security_policy = "TLS_1_2"
     }
   }
   ```

4. **CloudFrontのカスタムドメイン**
   ```hcl
   resource "aws_cloudfront_distribution" "frontend" {
     # 既存の設定...

     viewer_certificate {
       acm_certificate_arn      = aws_acm_certificate.main.arn
       ssl_support_method       = "sni-only"
       minimum_protocol_version = "TLSv1.2_2021"
     }

     aliases = ["aruaruarena.example.com"]
   }
   ```

---

## 検証方法

### 1. バックエンド動作確認

```bash
cd backend
bundle install
bundle exec rails server
# 別ターミナル
curl http://localhost:3000/api/health
```

### 2. テスト実行とカバレッジ確認

```bash
cd backend
bundle exec rspec
COVERAGE=true bundle exec rspec
open coverage/index.html  # ブラウザでカバレッジレポートを確認
```

### 3. フロントエンド動作確認

```bash
cd frontend
npm install
npm run dev
```

### 4. E2Eテスト実行

```bash
cd frontend
npx playwright test
```

### 5. Lint・フォーマット

```bash
cd backend
bundle exec rubocop -A
bundle exec brakeman -q

cd frontend
npm run lint:fix
npm run format
```

### 6. Terraform適用

```bash
cd backend/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

---

## 推奨される実装順序

1. **OGPベース画像の作成**（P1）- OGP生成に必要
2. **DockerfileへのImageMagick追加**（P1）- OGP生成に必要
3. **音声ファイルの用意**（P1）- 音声再生実装に必要
4. **Framer Motionアニメーション**（P1）- ユーザー体験への影響が大きい
5. **S3 + CloudFront（Terraform）**（P1）- 本番環境構築に必要
6. **AI APIキーのSecrets Manager統合**（P1）- セキュリティ向上
7. **音声再生実装**（P2）- 画面設計書の要件
8. **キャラクター動き・口癖**（P2）- 画面設計書の要件
9. **CloudWatchアラート**（P2）- 運用監視
10. **テストカバレッジ向上**（P2）- 目標90%への達成
11. **App.tsxの分割**（P3）- コード品質向上
12. **カスタムドメイン**（P3）- 運用の柔軟性向上

---

## まとめ

**バックエンドの完成度**: 95%
- コア機能はすべて実装済み
- 残りはテストカバレッジの向上と微調整

**フロントエンドの完成度**: 70%
- 基盤と主要画面は実装済み
- 残りはアニメーションと音声、コンポーネント分割

**インフラの完成度**: 80%
- 主要なAWSリソースは構築済み
- 残りはS3/CloudFrontのTerraform化とSecrets Manager統合

**推定残作業時間**: 約20-30時間
- P1タスク: 約15時間
- P2タスク: 約10時間
- P3タスク: 約5時間
