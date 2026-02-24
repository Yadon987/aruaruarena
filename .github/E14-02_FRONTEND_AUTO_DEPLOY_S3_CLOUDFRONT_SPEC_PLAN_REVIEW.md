- [重要度: 高]
- 問題点: `aws cloudfront create-invalidation` 実行後の完了待機条件が未定義で、invalidaton作成成功だけでジョブ成功と判断される曖昧さがある。
- 改善提案: `aws cloudfront wait invalidation-completed` を必須化し、「配信反映確認」までを完了条件に明記する。

- [重要度: 高]
- 問題点: `aws s3 sync frontend/dist ...` の実行ディレクトリ前提が曖昧で、`working-directory: ./frontend` の場合にパス不整合が発生する。
- 改善提案: 配信元パスを `DIST_DIR=dist`（frontend作業ディレクトリ時）として固定し、ディレクトリ存在チェックを追加する。

- [重要度: 高]
- 問題点: ロールバック手順で「直近成功runからartifact取得」とあるが、artifactの保存条件・保存期間・取得方法が仕様化されていない。
- 改善提案: デプロイ時に `frontend-dist` artifactを必ず保存（保持30日）し、`workflow_dispatch` 入力で `rollback_run_id` を受け取って復元する手順を明記する。

- [重要度: 中]
- 問題点: セキュリティ観点で、IAMロールに必要な最小権限が不明確。
- 改善提案: `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject`, `cloudfront:CreateInvalidation`, `cloudfront:GetInvalidation` の最小権限要件を記載する。

- [重要度: 中]
- 問題点: 通知要件がジョブサマリーのみで、失敗検知の運用フロー（誰が/いつ見るか）が曖昧。
- 改善提案: 最低限、失敗時に `if: failure()` でサマリー出力を強制し、必要に応じて将来拡張（Slack等）可能な記述にする。

- [重要度: 低]
- 問題点: 非機能要件の「10分以内」に測定基準がない。
- 改善提案: `build`/`sync`/`invalidation(wait)` の各ステップ時間をログで確認可能にする旨を追記する。

完全版:

```md
---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E14-03/E14-04/E14-06: S3同期とCloudFront invalidation'
labels: 'spec, E14, frontend, ci/cd'
assignees: ''
---

## 📋 概要

E14の推奨Issue分割の2つ目として、フロントエンドビルド成果物をS3へ同期し、CloudFront invalidation完了待機までをGitHub Actionsで自動実行する。対象はS3同期（E14-03）、CloudFront invalidation（E14-04）、失敗時通知とロールバック手順のドキュメント化（E14-06）に限定する。

## 🎯 目的

- `main` 反映後にS3配信物を自動更新し、手動デプロイを廃止する
- CloudFrontキャッシュ無効化と完了待機を自動化し、更新反映遅延を最小化する
- 失敗時の復旧手順を定義し、運用時のMTTRを短縮する

---

## 📝 詳細仕様

### 機能要件
- 既存の `.github/workflows/deploy-frontend.yml` に以下ステップを追加する
  - `Verify dist directory`
  - `Sync assets to S3`
  - `Create CloudFront invalidation`
  - `Wait CloudFront invalidation completed`
  - `Publish failure summary`
  - `Upload deploy artifact`
- 実行順序を `npm ci` → `npm run build` → `Verify dist directory` → `Sync assets to S3` → `Create CloudFront invalidation` → `Wait CloudFront invalidation completed` に固定する
- `working-directory: ./frontend` 前提で配信元を `dist` に固定し、`dist` が存在しない場合は即時失敗する
- S3同期は以下コマンドを使用する
  - `aws s3 sync dist s3://$S3_BUCKET_FRONTEND --delete --exact-timestamps`
- CloudFront invalidationは全体パスを対象とする
  - 作成: `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'`
  - 完了待機: `aws cloudfront wait invalidation-completed --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --id <invalidation_id>`
- `S3_BUCKET_FRONTEND` と `CLOUDFRONT_DISTRIBUTION_ID` をGitHub Variablesに必須定義する
- 失敗時通知として、`if: failure()` でGitHub Actionsジョブサマリーに以下を出力する
  - 失敗ステップ名
  - 実行run URL
  - 初動手順へのリンク（`docs/deploy/frontend.md`）
- ロールバック手順を `docs/deploy/frontend.md` に追記する
  - 各デプロイrunで `frontend-dist` artifact（`dist` 一式）を保持30日で保存する
  - `workflow_dispatch` の `rollback_run_id` 指定で対象artifactを取得し、S3へ再同期する
  - 再同期後にCloudFront invalidation（`/*`）を再実行する
- IAMロールの最小権限を仕様化する
  - `s3:ListBucket`（対象バケットのみ）
  - `s3:PutObject`, `s3:DeleteObject`（対象バケット配下のみ）
  - `cloudfront:CreateInvalidation`, `cloudfront:GetInvalidation`（対象Distributionのみ）
- ログ追跡性のためステップ名を固定化する

### 非機能要件
- `aws s3 sync --delete` によりS3上不要ファイルを削除し、配信差分を残さない
- デプロイ処理全体（S3同期+invalidation作成+完了待機）は10分以内を目標とする
- CloudFront invalidationの完了待機失敗時はジョブを失敗で終了し、成功扱いにしない
- 失敗時に、再実行可否とロールバック要否を判断できるログを残す
- `build`/`sync`/`invalidation(wait)` の各ステップ実行時間をActionsログで確認できること

### UI/UX設計
- N/A（CI/CDワークフローのみ）

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | N/A |
| PK | N/A |
| SK | N/A |
| GSI | N/A |

### API設計
| 項目 | 値 |
|------|-----|
| Method | N/A |
| Path | N/A |
| Request Body | N/A |
| Response (成功) | N/A |
| Response (失敗) | N/A |

### AIプロンプト設計
- N/A

### 実装対象ファイル
- `.github/workflows/deploy-frontend.yml`（更新）
- `docs/deploy/frontend.md`（更新）

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)
- [ ] 正常系:
  - N/A（アプリコードの変更なし）
- [ ] 異常系:
  - N/A（アプリコードの変更なし）
- [ ] 境界値:
  - N/A（アプリコードの変更なし）

### Request Spec (API)
- [ ] N/A（API仕様変更なし）

### External Service (WebMock/VCR)
- [ ] N/A

### Workflow Test
- [ ] `S3_BUCKET_FRONTEND` と `CLOUDFRONT_DISTRIBUTION_ID` 設定済みで `Sync assets to S3` が成功する
- [ ] `dist` 未生成時に `Verify dist directory` で失敗し、後続へ進まない
- [ ] `aws s3 sync --delete` により削除済みファイルがS3から除去される
- [ ] invalidation作成後に `Wait CloudFront invalidation completed` が成功する
- [ ] `CLOUDFRONT_DISTRIBUTION_ID` 未設定または不正時に invalidation関連ステップで失敗する
- [ ] S3バケット名不正時に `Sync assets to S3` で失敗し、後続へ進まない
- [ ] 失敗時に `Publish failure summary` が実行され、run URLと復旧導線が残る
- [ ] 各runで `frontend-dist` artifact が保存される
- [ ] `workflow_dispatch` + `rollback_run_id` でartifact復元デプロイが実行できる

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** `S3_BUCKET_FRONTEND` と `CLOUDFRONT_DISTRIBUTION_ID` が設定済み
      **When** `frontend` 変更を含むコミットが `main` にpushされる
      **Then** `Build frontend` 成功後に `Sync assets to S3` が実行される
      **And** `Create CloudFront invalidation` と `Wait CloudFront invalidation completed` が成功する

- [ ] **Given** 既存S3配信物に不要ファイルが残っている
      **When** `Sync assets to S3` を実行する
      **Then** 不要ファイルがS3から削除され、`dist` と一致する

- [ ] **Given** デプロイが成功する
      **When** invalidation完了待機まで終了する
      **Then** 最新フロント画面を取得できる

### 異常系 (Error Path)
- [ ] **Given** `S3_BUCKET_FRONTEND` が未設定または存在しないバケット名
      **When** `Sync assets to S3` を実行する
      **Then** 該当ステップで失敗し、後続の invalidation は実行されない

- [ ] **Given** `CLOUDFRONT_DISTRIBUTION_ID` が未設定または無効
      **When** invalidation作成または完了待機を実行する
      **Then** 該当ステップで失敗し、ジョブは失敗終了する

- [ ] **Given** デプロイ途中で失敗する
      **When** `Publish failure summary` が実行される
      **Then** 失敗ステップ名とrun URLと復旧ドキュメント導線がジョブサマリーに残る

- [ ] **Given** 復旧が必要な障害が発生する
      **When** `workflow_dispatch` で `rollback_run_id` を指定して実行する
      **Then** 指定runの `frontend-dist` artifactからS3再同期とinvalidationが完了する

### 境界値 (Edge Case)
- [ ] **Given** S3上に大量の不要ファイルがある
      **When** `aws s3 sync --delete` を実行する
      **Then** タイムアウトせず完了し、削除漏れがない

- [ ] **Given** 同一日に複数回の `main` デプロイが連続する
      **When** 各runで invalidation を実行する
      **Then** 各runが独立して成功/失敗判定され、判定根拠がログで追跡できる

- [ ] **Given** `workflow_dispatch` により手動実行される
      **When** 直前成功runの後に再実行する
      **Then** 冪等に完了し、S3配信物の不整合が発生しない

---

## 🔗 関連資料
- `docs/epics.md`（E14: フロントエンド自動デプロイ）
- `.github/E14-01_FRONTEND_AUTO_DEPLOY_WORKFLOW_SPEC_PLAN.md`（Issue 1仕様）
- `.github/workflows/deploy-frontend.yml`
- `docs/deploy/frontend.md`

---

**レビュアーへの確認事項:**
- [ ] Issue 2のスコープがE14-03/E14-04/E14-06に限定されているか
- [ ] S3同期とCloudFront invalidation完了待機の成功条件が明確か
- [ ] `--delete` 利用による最新化要件とリスクが適切に整理されているか
- [ ] 失敗通知とロールバック手順が運用可能な粒度で記述されているか
- [ ] IAM権限が最小権限になっているか
- [ ] Issue 1の前提（OIDC認証・実行条件）と矛盾していないか
```
