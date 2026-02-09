# あるあるアリーナ - Epic（機能単位）リスト

作成日: 2026年2月8日
バージョン: 2.0

---

## 概要

本ドキュメントは「あるあるアリーナ」の実装予定機能をEpic（機能単位）で整理したものです。
各Epicは複数のストーリー（タスク）で構成され、優先順位と依存関係を明記しています。

---

## Epic一覧

| Epic ID | Epic名 | 優先順位 | 依存関係 | ステータス |
|---------|--------|----------|----------|-----------|
| E01 | テスト環境構築（バックエンド） | P0（最優先） | なし | ✅ 完了 |
| E02 | インフラ構築（AWS） | P0（最優先） | なし | 進行中 |
| E03 | DynamoDBスキーマ定義 | P0（最優先） | E02 | ✅ 完了 |
| E04 | フロントエンド基盤構築 | P0（最優先） | なし |  |
| E05 | 投稿API | P0（最優先） | E03 |  |
| E06 | AI審査システム | P0（最優先） | E05 |  |
| E07 | 投稿詳細API | P0（最優先） | E06 |  |
| E08 | ランキングAPI | P1（高） | E06 |  |
| E09 | レート制限・スパム対策 | P1（高） | E05 |  |
| E10 | OGP画像生成 | P1（高） | E06 |  |
| E11 | 再審査API | P2（中） | E07 |  |
| E12 | トップ画面（フロントエンド） | P2（中） | E04, E05, E08 |  |
| E13 | 審査中画面（フロントエンド） | P2（中） | E04, E05 |  |
| E14 | 審査結果モーダル（フロントエンド） | P2（中） | E04, E07 |  |
| E15 | 自分の投稿一覧（フロントエンド） | P3（低） | E14 |  |
| E16 | プライバシーポリシー（フロントエンド） | P3（低） | E04 |  |
| E17 | BGM・SE再生 | P3（低） | E12, E13, E14 |  |

---

## Epic詳細

---

### E01: テスト環境構築（バックエンド）

**概要**: RSpecを使用したテスト環境のセットアップ

**ストーリー**:
- [x] E01-01: RSpecの設定（spec/spec_helper.rb）
- [x] E01-02: FactoryBotの設定（spec/factories/）
  - ✅ spec/support/factory_bot.rbは作成済み
  - ✅ spec/factories/ディレクトリもbackendに移行済み
- [x] E01-03: SimpleCovの設定（カバレッジ90%以上）
- [x] E01-04: VCR（API Mocking）の設定
- [x] E01-05: DynamoDB Localとの連携（spec/support/dynamoid.rb）
- [x] E01-06: RuboCopの設定（.rubocop.yml）
- [x] E01-07: Brakemanの設定（セキュリティスキャン）
  - ✅ Gemfileに含まれている
  - ✅ 設定ファイル不要（コマンドラインツール）

**受入基準**:
- `bundle exec rspec` でテスト実行可能
- `COVERAGE=true bundle exec rspec` でカバレッジレポート生成
- VCRでAI APIのモックが可能
- DynamoDB Localでテスト用テーブルが自動作成

**関連ファイル**:
- `spec/spec_helper.rb`
- `spec/rails_helper.rb`
- `spec/support/factory_bot.rb`
- `spec/support/vcr.rb`
- `.rubocop.yml`
- `.simplecov`

---

### E02: インフラ構築（AWS）

**概要**: AWSインフラの構築（Terraform）

**構成**:
- Lambda（Dockerコンテナ）
- DynamoDB（4テーブル）
- API Gateway（HTTP API）
- S3（静的ホスティング）
- CloudFront（CDN + OGPキャッシュ）
- EventBridge（ウォームアップ）

**ストーリー**:
- [x] E02-01: Terraform設定の実装
- [x] E02-02: Lambda関数のデプロイ
- [x] E02-03: DynamoDBテーブルの作成
- [x] E02-04: API Gatewayの設定
- [x] E02-05: S3 + CloudFrontの設定（S3のみ完了）
- [ ] E02-06: EventBridgeの設定
- [ ] E02-07: GitHub Actions（CI/CD）の実装

**受入基準**:
- 月額コスト: $0.26/月（AWS）+ $2.25/月（AI）
- CloudWatchアラート設定
- PITR（Point-In-Time Recovery）有効化

**関連ファイル**:
- `backend/terraform/main.tf`
- `backend/terraform/lambda.tf`
- `backend/terraform/dynamodb.tf`
- `.github/workflows/deploy.yml`

---

### E03: DynamoDBスキーマ定義

**概要**: 4つのDynamoDBテーブルのスキーマ定義と設定

**テーブル**:
- posts（投稿データ）
- judgments（審査結果）
- rate_limits（レート制限）
- duplicate_checks（重複チェック）

**ストーリー**:
- [x] E03-01: postsテーブルの設計（PK: id, GSI: RankingIndex）
- [x] E03-02: judgmentsテーブルの設計（PK: post_id, SK: persona）
- [x] E03-03: rate_limitsテーブルの設計（PK: identifier, TTL）
- [x] E03-04: duplicate_checksテーブルの設計（PK: body_hash, TTL）
- [x] E03-05: GSI（RankingIndex）の定義
- [x] E03-06: TTL設定の実装
- [x] E03-07: Dynamoidモデルの実装
- [x] E03-08: マイグレーションスクリプトの作成

**受入基準**:
- ✅ docs/db_schema.md に従った設計
- ✅ PITR（Point-In-Time Recovery）有効化
- ✅ TTLによる自動削除設定
- ✅ score_keyのフォーマット: `inv_score#created_at#id`

**関連ファイル**:
- `app/models/post.rb`
- `app/models/judgment.rb`
- `app/models/rate_limit.rb`
- `app/models/duplicate_check.rb`
- `lib/tasks/dynamodb.rake`

---

### E04: フロントエンド基盤構築

**概要**: React + Vite + TypeScript環境の構築と共通設定

**ストーリー**:
- [ ] E04-01: Viteプロジェクトの作成 (React + TypeScript)
- [ ] E04-02: Tailwind CSSの導入と設定
- [ ] E04-03: ESLint / Prettier の設定
- [ ] E04-04: ディレクトリ構成の整備
- [ ] E04-05: 共通型定義 (Types) の作成
- [ ] E04-06: APIクライアント(axios/fetch)の基盤実装
- [ ] E04-07: TanStack Query / Framer Motion の導入
- [ ] E04-08: Playwrightの導入と設定
- [ ] E04-09: テスト用モックサーバー（MSW）の導入

**関連ファイル**:
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tailwind.config.js`

---

### E05: 投稿API

**概要**: ユーザーが「あるある」を投稿するAPIエンドポイントを実装

**エンドポイント**: `POST /api/posts`

**ストーリー**:
- [ ] E05-01: 投稿バリデーション（ニックネーム1-20文字、本文3-30文字）
- [ ] E05-02: DynamoDBへの投稿保存
- [ ] E05-03: UUID生成・レスポンス返却
- [ ] E05-04: 初期ステータス `judging` の設定
- [ ] E05-05: RSpecテスト（正常系・異常系）
- [ ] E05-06: 審査トリガー（Lambda内でThread並列実行）
  - **採用方式**: Thread.newでJudgePostServiceを非同期実行
  - **理由**: Lambda環境ではSidekiq等が使えないため
  - **代替案**: Active Job + Async Adapter（将来の移行用に検討）

**受入基準**:
- ニックネーム: 1-20文字（8文字超で省略表示）
- 本文: 3-30文字（grapheme単位で厳密カウント）
- レスポンス形式: `{ id: "uuid", status: "judging" }`
- エラーフォーマット: `{ error: "...", code: "..." }`

**関連ファイル**:
- `app/controllers/api/posts_controller.rb`
- `app/models/post.rb`
- `spec/requests/api/posts_spec.rb`

---

### E06: AI審査システム

**概要**: 3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）が並列で審査を実行

**AI APIs**:
- Gemini 2.5 Flash（ひろゆき風）
- GLM-4.7-FlashX（デヴィ婦人風）
- GPT-4o-mini（中尾彬風）

**ストーリー**:
- [ ] E06-01: AI Adapter基底クラスの実装
- [ ] E06-02: Gemini Adapterの実装
- [ ] E06-03: GLM Adapterの実装
- [ ] E06-04: OpenAI Adapterの実装
- [ ] E06-05: JudgePostServiceの実装（並列処理）
- [ ] E06-06: 審査結果のDynamoDB保存
- [ ] E06-07: ステータス更新（judging → scored/failed）
- [ ] E06-08: RSpecテスト（正常系・異常系・タイムアウト）

**採点項目**（5項目×20点＝100点満点）:
- 共感度（0-20）
- 面白さ（0-20）
- 簡潔さ（0-20）
- 独創性（0-20）
- 表現力（0-20）

**審査員のバイアス**:
- ひろゆき風: 独創性(+3)、共感度(-2)
- デヴィ婦人風: 表現力(+3)、面白さ(+2)
- 中尾彬風: 面白さ(+3)、共感度(+2)

**受入基準**:
- 3人並列実行（Thread使用）
- 2人以上成功: `status = scored`
- 1人以下成功: `status = failed`
- タイムアウト時: 適切なエラーハンドリング

**関連ファイル**:
- `app/services/judge_post_service.rb`
- `app/adapters/base_ai_adapter.rb`
- `app/adapters/gemini_adapter.rb`
- `app/adapters/glm_adapter.rb`
- `app/adapters/openai_adapter.rb`
- `app/prompts/hiroyuki.txt`
- `app/prompts/dewi.txt`
- `app/prompts/nakao.txt`
- `app/models/judgment.rb`

---

### E07: 投稿詳細API

**概要**: 投稿詳細と審査状況を取得

**エンドポイント**: `GET /api/posts/:id`

**ストーリー**:
- [ ] E07-01: 投稿詳細取得の実装
- [ ] E07-02: 審査結果の結合
- [ ] E07-03: ランキング順位の計算
- [ ] E07-04: RSpecテスト（正常系・異常系）

**受入基準**:
- レスポンス形式:
  ```json
  {
    "id": "uuid",
    "nickname": "太郎",
    "body": "スヌーズ押して二度寝",
    "average_score": 85.3,
    "rank": 12,
    "total_count": 500,
    "judgments": [
      {
        "persona": "hiroyuki",
        "total_score": 82,
        "empathy": 14,
        "humor": 17,
        "brevity": 18,
        "originality": 19,
        "expression": 14,
        "comment": "それって本当？",
        "success": true
      }
    ]
  }
  ```

**関連ファイル**:
- `app/controllers/api/posts_controller.rb`
- `spec/requests/api/posts_spec.rb`

---

### E08: ランキングAPI

**概要**: TOP20ランキングを取得するAPIエンドポイントを実装

**エンドポイント**: `GET /api/rankings`

**ストーリー**:
- [ ] E08-01: GSI RankingIndexを使用したクエリ実装
- [ ] E08-02: ランキング順位の計算
- [ ] E08-03: レスポンスフォーマットの実装
- [ ] E08-04: RSpecテスト（正常系・境界値）

**受入基準**:
- TOP20を取得（`status = scored` のみ）
- スコア降順・同点時は作成日時昇順
- レスポンス形式:
  ```json
  {
    "rankings": [
      {
        "rank": 1,
        "id": "uuid",
        "nickname": "太郎",
        "body": "スヌーズ押して二度寝",
        "average_score": 95.3
      }
    ],
    "total_count": 500
  }
  ```

**関連ファイル**:
- `app/controllers/api/rankings_controller.rb`
- `spec/requests/api/rankings_spec.rb`

---

### E09: レート制限・スパム対策

**概要**: 投稿のレート制限とスパム投稿を防止

**ストーリー**:
- [ ] E09-01: RateLimiterServiceの実装（IP/ニックネーム5分制限）
- [ ] E09-02: DuplicateCheckServiceの実装（同一テキスト24時間制限）
- [ ] E09-03: DynamoDB rate_limits テーブルの実装
- [ ] E09-04: DynamoDB duplicate_checks テーブルの実装
- [ ] E09-05: TTLによる自動削除設定
- [ ] E09-06: RSpecテスト（正常系・異常系）

**受入基準**:
- IPごとに5分1回
- ニックネームごとに5分1回
- 同一テキストは24時間以内に投稿不可
- エラーメッセージ: `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }`

**関連ファイル**:
- `app/services/rate_limiter_service.rb`
- `app/services/duplicate_check_service.rb`
- `app/models/rate_limit.rb`
- `app/models/duplicate_check.rb`

---

### E10: OGP画像生成

**概要**: SNSシェア用のOGP画像を動的生成

**エンドポイント**: `GET /ogp/posts/:id.png`

**ストーリー**:
- [ ] E10-00: DockerfileへのImageMagick追加
- [ ] E10-01: OgpGeneratorServiceの実装
- [ ] E10-02: mini_magickによる画像合成
- [ ] E10-03: CloudFrontキャッシュ戦略の実装
- [ ] E10-04: ウォームアップ処理（Thread.new）
- [ ] E10-05: RSpecテスト（画像生成・キャッシュ）

**受入基準**:
- 投稿内容・スコアを含む画像生成
- CloudFrontで1週間キャッシュ
- 審査完了時にウォームアップ実行
- 最大0.5秒でThread完了待機

**関連ファイル**:
- `app/controllers/api/ogp_controller.rb`
- `app/services/ogp_generator_service.rb`
- `spec/requests/api/ogp_spec.rb`

---

### E11: 再審査API

**概要**: 失敗した審査員のみを再審査

**エンドポイント**: `POST /api/posts/:id/rejudge`

**ストーリー**:
- [ ] E11-01: RejudgePostServiceの実装
- [ ] E11-02: 失敗した審査員の特定
- [ ] E11-03: 審査結果の上書き保存
- [ ] E11-04: RSpecテスト（正常系・異常系）

**受入基準**:
- リクエスト形式: `{ "failed_personas": ["dewi"] }`
- 失敗した審査員のみ再実行
- 審査結果はDynamoDBで上書き

**関連ファイル**:
- `app/controllers/api/posts_controller.rb`
- `app/services/rejudge_post_service.rb`
- `spec/requests/api/posts_spec.rb`

---

### E12: トップ画面（フロントエンド）

**概要**: メイン画面（ランキング一覧＋投稿フォーム）

**コンポーネント**:
- ヘッダー（ロゴ、タイトル、ミュートトグル）
- 投稿フォーム（ニックネーム、本文、投稿ボタン）
- ランキング表示エリア（TOP20）
- フッター（自分の投稿一覧、プライバシーポリシー）

**ストーリー**:
- [ ] E12-01: レイアウト実装（Tailwind CSS）
- [ ] E12-02: 投稿フォームの実装
- [ ] E12-03: ランキング表示の実装
- [ ] E12-04: TanStack Queryでのデータ取得
- [ ] E12-05: LocalStorageでの自分の投稿管理
- [ ] E12-06: 自分の投稿のハイライト表示
- [ ] E12-07: Playwright E2Eテスト

**受入基準**:
- 投稿成功時にIDをLocalStorageに保存
- ランキングは3秒ごとに自動更新（ポーリング）
- 自分の投稿はハイライト表示
- レスポンシブ対応

**開発推奨**:
- **モック使用推奨**: バックエンドAPI（E05, E08）の実装前に、MSW（Mock Service Worker）でモックデータを使用して先行開発可能
- TanStack Queryのmockデータ機能を活用

**関連ファイル**:
- `frontend/src/components/Header.tsx`
- `frontend/src/components/PostForm.tsx`
- `frontend/src/components/RankingList.tsx`
- `frontend/src/hooks/useRankings.ts`

---

### E13: 審査中画面（フロントエンド）

**概要**: 審査中のフルスクリーン画面

**コンポーネント**:
- 投稿内容表示
- 3人のAI審査員キャラクター（Framer Motionアニメーション）
- 審査アニメーション（口癖発言）
- ローディング表示

**ストーリー**:
- [ ] E13-01: フルスクリーンレイアウトの実装
- [ ] E13-02: 審査員キャラクターの実装
- [ ] E13-03: Framer Motionアニメーション
- [ ] E13-04: ランダム口癖の実装
- [ ] E13-05: ポーリング（3秒ごと・最大60秒）
- [ ] E13-06: タイムアウト処理
- [ ] E13-07: Playwright E2Eテスト

**受入基準**:
- 投稿IDでポーリング（GET /api/posts/:id）
- 審査完了時にトップ画面にフェード遷移
- 60秒タイムアウト時のエラーモーダル

**開発推奨**:
- **モック使用推奨**: バックエンドAPI（E05, E07）の実装前に、MSWでモックデータを使用してアニメーションとUI先行開発可能

**関連ファイル**:
- `frontend/src/components/JudgingScreen.tsx`
- `frontend/src/components/JudgeCharacter.tsx`
- `frontend/src/hooks/usePolling.ts`

---

### E14: 審査結果モーダル（フロントエンド）

**概要**: 審査結果を表示するモーダル

**コンポーネント**:
- 投稿情報（ニックネーム、本文、平均点、順位）
- 3人の審査員の詳細（5項目スコア、コメント）
- アクションボタン（再審査、SNSシェア）
- 閉じるボタン

**ストーリー**:
- [ ] E14-01: モーダルレイアウトの実装
- [ ] E14-02: 審査結果詳細表示
- [ ] E14-03: 再審査ボタンの実装
- [ ] E14-04: SNSシェアボタンの実装
- [ ] E14-05: OGP画像プレビュー
- [ ] E14-06: Framer Motionアニメーション
- [ ] E14-07: Playwright E2Eテスト

**受入基準**:
- 成功時（TOP20入り）: 威風堂々（ワンショット）
- 失敗時（圏外）: 運命 冒頭（ワンショット）
- 再審査ボタンは失敗時のみ表示
- SNSシェアは成功時のみ有効

**開発推奨**:
- **モック使用推奨**: バックエンドAPI（E07, E11）の実装前に、MSWでモックデータを使用してUI先行開発可能

**関連ファイル**:
- `frontend/src/components/ResultModal.tsx`
- `frontend/src/components/JudgeDetail.tsx`

---

### E15: 自分の投稿一覧（フロントエンド）

**概要**: LocalStorageから自分の投稿一覧を表示

**ストーリー**:
- [ ] E15-01: モーダルレイアウトの実装
- [ ] E15-02: LocalStorageからの取得
- [ ] E15-03: 投稿詳細への遷移
- [ ] E15-04: Playwright E2Eテスト

**受入基準**:
- 投稿クリックで審査結果モーダルに切り替え
- 空状態メッセージの表示

**関連ファイル**:
- `frontend/src/components/MyPostsModal.tsx`

---

### E16: プライバシーポリシー（フロントエンド）

**概要**: 利用規約・プライバシーポリシーの表示

**ストーリー**:
- [ ] E16-01: モーダルレイアウトの実装
- [ ] E16-02: スクロール可能な実装
- [ ] E16-03: Playwright E2Eテスト

**受入基準**:
- スクロール可能
- `Esc` キーで閉じる

**関連ファイル**:
- `frontend/src/components/PrivacyPolicyModal.tsx`

---

### E17: BGM・SE再生

**概要**: シーンに応じたBGM・SE再生

**ストーリー**:
- [ ] E17-01: Howler.jsの導入
- [ ] E17-02: BGM再生の実装
- [ ] E17-03: SE再生の実装
- [ ] E17-04: クロスフェード（0.5s）
- [ ] E17-05: ミュートトグル（LocalStorageに保存）
- [ ] E17-06: Playwright E2Eテスト

**受入基準**:
- デフォルトはミュート（ユーザー操作でON）
- ミュート状態をLocalStorageに保存
- シーン切り替え時にクロスフェード

**関連ファイル**:
- `frontend/src/hooks/useSound.ts`

---

## 実装順序の推奨

**重要**: TDD（テスト駆動開発）を実践するため、E01（テスト環境構築）を最優先で実施してください。

### フェーズ0: 環境セットアップ（全体）
1. **E01: テスト環境構築**（RSpec/FactoryBot/SimpleCov/VCR）- **最優先**
2. **E02: インフラ構築**（ローカルはDocker、AWSはTerraform）
3. **E03: DynamoDBスキーマ定義**（4テーブル設計・実装）
4. **E04: フロントエンド基盤構築**（並列実装可・バックエンド完了待たず）

### フェーズ1: 投稿・審査の基本フロー
5. **E05: 投稿API**（Thread方式で非同期審査をトリガー）
6. **E06: AI審査システム**（3人並列実行）
7. **E07: 投稿詳細API**（審査結果結合）

### フェーズ2: ランキング・公開
8. **E08: ランキングAPI**（TOP20取得）
9. **E09: レート制限・スパム対策**（5分制限・重複チェック）
10. **E10: OGP画像生成**（SNSシェア用）

### フェーズ3: 再審査・高度な機能
11. **E11: 再審査API**（失敗審査員のみ再実行）

### フェーズ4: フロントエンド実装
12. **E12: トップ画面**（モック使用で先行開発可）
13. **E13: 審査中画面**（モック使用で先行開発可）
14. **E14: 審査結果モーダル**（モック使用で先行開発可）

### フェーズ5: 追加機能
15. **E15: 自分の投稿一覧**
16. **E16: プライバシーポリシー**
17. **E17: BGM・SE再生**

---

## 更新履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-02-08 | 2.0 | 実装順序に合わせてEpic IDをE01-E17に完全リナンバリング |
| 2026-02-08 | 1.1 | 以下の修正を適用<br>- E999（テスト環境構築）を追加<br>- E015（DynamoDBスキーマ定義）を追加<br>- E001-06をThread方式に明確化<br>- 実装順序をベストプラクティスに更新<br>- 各フロントエンドEpicに「モック使用推奨」を追記 |
| 2026-02-08 | 1.0 | 初版作成 |

---

*本ドキュメントはプロジェクトの進化に合わせて更新してください*
