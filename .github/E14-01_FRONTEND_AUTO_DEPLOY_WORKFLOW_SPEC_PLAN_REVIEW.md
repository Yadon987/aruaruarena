以下のIssueもしくはプランについて、抜け・漏れ・曖昧さを指摘してください。
レビュワーは非常に細かい所まで指摘してくるので時間はいくらかけてもいいので徹底的に精査してほしい
勝手に文章を省略したりしないように気を付けて
その完全版をコピーしやすいようにコードブロックで全体を囲んで出力してください
コードブロックの中にさらにコードブロック（```ruby など）が含まれて重複し、表示が崩れないように注意してください

完全版が完成したら、Plan modeを終了してレビュー対象の既存のプラン、既存のレビューもしくはGithubの既存のissueに内容を上書き保存して、その後に上書き完了を報告して待機


【プラン or issue 参照内容】
- `.github/E14-01_FRONTEND_AUTO_DEPLOY_WORKFLOW_SPEC_PLAN.md`

【チェック観点】
1. 仕様の曖昧性
   - 「〜できる」が具体的でない部分
   - 判断基準が不明確な部分

2. エッジケース・境界値
   - 入力値の上限/下限
   - 異常系のパターン
   - 並行処理時の挙動

3. セキュリティ
   - 権限チェックの漏れ
   - バリデーションの不足
   - 機密情報の扱い

4. 非機能要件
   - パフォーマンス（N+1クエリ、レート制限）
   - エラーハンドリング
   - ログ出力

5. テスト観点
   - Example Mappingで網羅できていないシナリオ
   - 統合テストで必要な観点

6. DynamoDB設計（Aruaru Arena特有）
   - アクセスパターンの網羅性
   - GSIの必要性
   - PK/SKの設計妥当性

7. 出力要件
   - 完全版が完成したら、Plan modeを終了してレビュー対象の既存のプラン、既存のレビューもしくはGithubの既存のissueに内容を更新
   - もしレビュー対象のissueが未作成だった場合、issueを新規作成


※プロジェクトのルールはCLAUDE.mdを参照

指摘は以下の形式で：
- [重要度: 高/中/低]
- 問題点
- 改善提案

---

## レビュー結果

- [重要度: 高]
- 問題点: Issue 1の範囲で未実装と定義している `aws s3 sync` / `cloudfront invalidation` に必要な `S3_BUCKET_FRONTEND` と `CLOUDFRONT_DISTRIBUTION_ID` を「必須Secrets」に含めており、スコープと必須条件が矛盾している。
- 改善提案: Issue 1必須は `AWS_ROLE_ARN_FRONTEND_DEPLOY` のみに限定し、`S3_BUCKET_FRONTEND` と `CLOUDFRONT_DISTRIBUTION_ID` は「Issue 2で必須化」に明示的に分離する。

- [重要度: 高]
- 問題点: `docs/deploy/frontend.md` を更新対象にしているが、現状 `docs/deploy/` ディレクトリが存在しないため、作成責務が曖昧。
- 改善提案: 実装対象を「`docs/deploy/frontend.md` を新規作成（必要に応じて `docs/deploy/` も新規作成）」と明記し、受入条件にドキュメント作成完了を追加する。

- [重要度: 中]
- 問題点: `concurrency` が「並列抑止」としか記載されておらず、`cancel-in-progress` の値が未定義。運用時に「後続コミットを優先するか」の判断が揺れる。
- 改善提案: `cancel-in-progress: false` を固定し、デプロイ中断を防ぐ方針を仕様として確定する。

- [重要度: 中]
- 問題点: ワークフロー起動条件が `push` のみで、仕様検証時の手動実行手段がない。初回導入時の検証がPRマージ依存になり、検証効率が低い。
- 改善提案: `workflow_dispatch` を追加し、初回導入と運用時の手動再実行を可能にする。

- [重要度: 中]
- 問題点: 失敗時ログ要件はあるが、失敗要因の分類（認証失敗 / 依存不整合 / ビルド失敗）の受入判定がない。
- 改善提案: 失敗系ACに、代表的な失敗パターンごとに「どのステップで失敗し、何がログに残るか」を明記する。

- [重要度: 低]
- 問題点: `paths` に `frontend/**` を含むため `frontend/package-lock.json` は冗長。仕様上の重複が保守時にノイズになる。
- 改善提案: `paths` は `frontend/**` とワークフローファイルのみに簡素化する。

---

## 修正版（完全版）

````markdown
---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E14-01/E14-05: フロントエンド自動デプロイ用ワークフロー構築'
labels: 'spec, E14, frontend, ci/cd'
assignees: ''
---

## 📋 概要

E14の推奨Issue分割の1つ目として、`main` push時にフロントエンド自動デプロイを実行するGitHub Actionsワークフローの骨組みを作成する。対象はワークフローファイル作成（E14-01）と実行条件・Secrets整備（E14-05）に限定し、S3同期とCloudFront invalidationの実処理はIssue 2で扱う。

## 🎯 目的

- `main` への反映を起点にフロントエンド配信更新の自動化基盤を確立する
- デプロイ実行条件（ブランチ/パス）を固定化し、不要な実行を抑制する
- OIDCとGitHub Secrets/Variablesの責務分離を明確化し、安全に後続実装へ接続する

---

## 📝 詳細仕様

### 機能要件
- `.github/workflows/deploy-frontend.yml` を新規作成する
- `on` は以下を許可する
  - `push`（`main` のみ）
  - `workflow_dispatch`（手動検証用）
- `push.paths` は以下の更新時のみ実行する
  - `frontend/**`
  - `.github/workflows/deploy-frontend.yml`
- `concurrency` を設定し、同一refの並列デプロイを抑止する
  - `group: deploy-frontend-${{ github.ref }}`
  - `cancel-in-progress: false`
- `permissions` は最小権限とし、`id-token: write`, `contents: read` のみ許可する
- 実行環境は `ubuntu-latest` とし、Nodeは20系を使用する
- `actions/checkout` と `actions/setup-node` を利用し、`cache: npm` を有効化する
- `working-directory: ./frontend` で `npm ci` と `npm run build` を実行する
- AWS認証は `aws-actions/configure-aws-credentials` のOIDC方式を採用する
- Issue 1での必須設定値を以下に定義する
  - Secrets: `AWS_ROLE_ARN_FRONTEND_DEPLOY`
  - Variables: `AWS_REGION`
- Issue 2で必須化する設定値を以下に予約定義する（Issue 1では未使用）
  - VariablesまたはSecrets: `S3_BUCKET_FRONTEND`, `CLOUDFRONT_DISTRIBUTION_ID`
- S3同期/CloudFront invalidationはIssue 1では未実装とし、`TODO` コメント付きのダミーステップで接続点を残す
- 失敗時に追跡可能なよう、ステップ名を用途ベースで固定化する
  - `Checkout`
  - `Setup Node`
  - `Install dependencies`
  - `Build frontend`
  - `Configure AWS credentials`
  - `Deploy placeholder (Issue 2)`
- 設定手順ドキュメントとして `docs/deploy/frontend.md` を新規作成する（必要に応じて `docs/deploy/` も新規作成）

### 非機能要件
- `frontend` 変更がない `main` push ではワークフローが起動しないこと
- `frontend` 変更を含む `main` push では1分以内にジョブ開始されること
- `npm ci` から `npm run build` 完了まで15分以内（GitHub Hosted Runner想定）
- OIDCで認証し、長期AWSキーをワークフロー/Secretsに保持しないこと
- 失敗時ログに最低限「失敗ステップ名」「終了コード」「実行時刻」が残ること

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
- `.github/workflows/deploy-frontend.yml`（新規）
- `docs/deploy/frontend.md`（新規）

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
- [ ] `frontend` 配下変更を含む `main` push でワークフローが起動する
- [ ] `frontend` 配下変更なしの `main` push でワークフローが起動しない
- [ ] `workflow_dispatch` で手動実行できる
- [ ] `npm ci` 成功後に `npm run build` が実行される
- [ ] `AWS_ROLE_ARN_FRONTEND_DEPLOY` 未設定時に `Configure AWS credentials` で失敗する
- [ ] `npm ci` 失敗時に `Install dependencies` で停止し、後続ステップへ進まない
- [ ] `npm run build` 失敗時に `Build frontend` で停止し、失敗原因がログで判別できる
- [ ] ダミーステップ `Deploy placeholder (Issue 2)` が成功し、Issue 2への接続点として機能する

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** `frontend` 配下の変更を含むコミットが `main` にpushされる
      **When** GitHub Actionsが起動する
      **Then** `deploy-frontend` ワークフローが実行される
      **And** `Install dependencies` と `Build frontend` が順番に成功する

- [ ] **Given** OIDCロール（`AWS_ROLE_ARN_FRONTEND_DEPLOY`）と `AWS_REGION` が設定済み
      **When** `Configure AWS credentials` を実行する
      **Then** 認証が成功し、ダミーデプロイステップまで到達する

- [ ] **Given** `docs/deploy/frontend.md` が未作成
      **When** Issue 1を完了する
      **Then** Secrets/Variables設定手順と運用前チェック項目が文書化される

### 異常系 (Error Path)
- [ ] **Given** `AWS_ROLE_ARN_FRONTEND_DEPLOY` が未設定
      **When** ワークフローが実行される
      **Then** `Configure AWS credentials` で失敗する
      **And** ログで不足設定値を特定できる

- [ ] **Given** lockfile不整合などで依存解決が失敗する状態
      **When** `Install dependencies` を実行する
      **Then** 該当ステップで停止し、`Build frontend` は実行されない

- [ ] **Given** TypeScriptエラーなどでビルド不能な状態
      **When** `Build frontend` を実行する
      **Then** 該当ステップで停止し、失敗ログから原因を特定できる

### 境界値 (Edge Case)
- [ ] **Given** 同一ブランチで短時間に複数コミットが `main` へ連続pushされる
      **When** ワークフローが連続起動する
      **Then** 同時実行は抑止され、実行中ジョブは中断されない（`cancel-in-progress: false`）

- [ ] **Given** `.github/workflows/deploy-frontend.yml` のみ変更されたコミット
      **When** `main` へpushされる
      **Then** ワークフローが起動し、設定変更の妥当性を検証できる

- [ ] **Given** `frontend` 外のみ変更されたコミット
      **When** `main` へpushされる
      **Then** ワークフローは起動しない

---

## 🔗 関連資料
- `docs/epics.md`（E14: フロントエンド自動デプロイ）
- `.github/workflows/deploy.yml`（既存バックエンドデプロイワークフロー）
- `frontend/package.json`

---

**レビュアーへの確認事項:**
- [ ] Issue 1のスコープがE14-01/E14-05に限定されているか
- [ ] `push` + `workflow_dispatch` の実行条件が運用上妥当か
- [ ] Secrets/Variablesの必須・予約定義が矛盾なく整理されているか
- [ ] 失敗時の判定条件がステップ単位で明確か
- [ ] Issue 2への接続点（S3 sync/invalidation未実装）が曖昧でないか
````
