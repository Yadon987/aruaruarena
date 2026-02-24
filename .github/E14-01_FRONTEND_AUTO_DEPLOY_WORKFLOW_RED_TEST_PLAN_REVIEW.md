以下のIssueもしくはプランについて、抜け・漏れ・曖昧さを指摘してください。
レビュワーは非常に細かい所まで指摘してくるので時間はいくらかけてもいいので徹底的に精査してほしい
勝手に文章を省略したりしないように気を付けて
その完全版をコピーしやすいようにコードブロックで全体を囲んで出力してください
コードブロックの中にさらにコードブロック（```ruby など）が含まれて重複し、表示が崩れないように注意してください

完全版が完成したら、Plan modeを終了してレビュー対象の既存のプラン、既存のレビューもしくはGithubの既存のissueに内容を上書き保存して、その後に上書き完了を報告して待機


【プラン or issue 参照内容】
- `.github/E14-01_FRONTEND_AUTO_DEPLOY_WORKFLOW_RED_TEST_PLAN.md`

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
- 問題点: REDテスト実行手順で `deployFrontendRuntime.red.test.ts` を実行対象にしているが、テスト設計の節に当該ファイル名が定義されていないため、実行時にファイル不在で失敗するリスクがある。
- 改善提案: テストIDとファイル名を1対1で対応付け、実行コマンドと設計書の表記を一致させる。

- [重要度: 高]
- 問題点: 「REDは必ず失敗」の要件は書かれているが、何件失敗していればRED成立と判定するかが曖昧。
- 改善提案: 初回実行時に「AC対応テストで最低3件以上失敗」など定量条件を定義し、偶然1件のみ失敗の取りこぼしを防ぐ。

- [重要度: 中]
- 問題点: AC-05/AC-06（`npm ci` / `npm run build` 失敗時停止）が、静的検証だけでは停止挙動まで担保しにくい。
- 改善提案: 静的テストで「順序と存在」を担保し、停止挙動は別途擬似実行テスト（モック化したジョブランナー）で検証する計画へ分離する。

- [重要度: 中]
- 問題点: セキュリティ観点で「権限の過剰付与を禁止」までしかなく、`permissions` に余分なキーが存在した場合の失敗条件が明文化されていない。
- 改善提案: `permissions` はキー集合完全一致（`id-token`, `contents` のみ）を失敗条件に追加する。

- [重要度: 低]
- 問題点: `frontend` 外変更時に起動しない（AC-09）の検証がST-03単体に寄っており、否定ケースの明確なテストIDがない。
- 改善提案: AC-09専用テストケースを追加し、起動対象外パス（例: `backend/**`）を明示する。

---

## 修正版（完全版）

````markdown
# REDテスト計画書（改訂版）: E14-01 フロントエンド自動デプロイワークフロー

## 0. 目的

`.github/E14-01_FRONTEND_AUTO_DEPLOY_WORKFLOW_SPEC_PLAN.md` の受入条件（AC）を、TDDのREDフェーズで先に失敗テストとして固定する。

- 対象: `deploy-frontend.yml` のトリガー、パス条件、権限、Nodeビルド手順、OIDC認証、失敗時停止条件、Issue 2接続用ダミーステップ
- ゴール: 実装前に仕様境界をテストとして明文化し、Green実装時の判断ブレを防ぐ

---

## 1. 前提・制約（CLAUDE.md準拠）

- REDフェーズでは本番ワークフロー本体を変更しない（テストコードとテスト補助ファイルのみ追加）
- REDテストは「必ず失敗する状態」で追加する
- 初回RED実行で AC対応テストが **最低3件以上失敗** することを成立条件とする
- 失敗理由は仕様未実装・仕様不一致に限定し、構文エラー由来の失敗を禁止する
- テスト名・テストコメント・コミットメッセージは日本語で記述する
- 各テストケースに `何を検証するか` コメントを必ず付与する
- `skip` / `todo` / `pending` を使用しない
- 機密情報（AWSキー等）をテストに直接記述しない
- 既存CI/CD（`.github/workflows/deploy.yml`）を壊す変更を行わない

---

## 2. RED失敗条件

REDとして有効な失敗:

- `deploy-frontend.yml` が存在しない、または必須キーが不足している
- `on.push.branches` に `main` がない
- `push.paths` に `frontend/**` または `.github/workflows/deploy-frontend.yml` がない
- `workflow_dispatch` が未定義
- `permissions` が `{ id-token: write, contents: read }` の完全一致でない
- `working-directory: ./frontend` で `npm ci` → `npm run build` 順が崩れている
- `configure-aws-credentials` ステップがない
- `Deploy placeholder (Issue 2)` ステップがない
- `docs/deploy/frontend.md` が存在しない、または必須項目が欠落している

REDとして無効（修正対象）:

- YAMLパースライブラリ未導入でテストが落ちる
- テスト実行スクリプトの権限不足
- `node_modules` 未セットアップによる実行失敗

判定ルール:

- ACに対応するテストケースは初回実行で最低3件以上失敗すること
- 失敗ログで「仕様未実装または不一致」が識別できること
- 無効失敗（環境要因）が0件であること

---

## 3. スコープ

### 3.1 対象
- ワークフローファイル存在確認
- `push(main)` + `workflow_dispatch` トリガー定義
- `push.paths` フィルタ定義（対象/非対象）
- `concurrency` の `group` / `cancel-in-progress: false`
- `permissions` 最小権限の完全一致
- Node 20 + npmキャッシュ
- `npm ci` と `npm run build` の順序
- `configure-aws-credentials` によるOIDC設定
- ステップ名固定化
- Issue 2接続用ダミーステップ定義
- `docs/deploy/frontend.md` の設定手順・予約変数記載

### 3.2 非対象
- `aws s3 sync` 実行本体
- `aws cloudfront create-invalidation` 実行本体
- AWS実環境へのデプロイ疎通確認

---

## 4. 仕様固定値（テスト正本）

- 対象ワークフロー: `.github/workflows/deploy-frontend.yml`
- 必須トリガー:
  - `push.branches: [main]`
  - `workflow_dispatch`
- 必須パス:
  - `frontend/**`
  - `.github/workflows/deploy-frontend.yml`
- 非対象パス例:
  - `backend/**`
  - `docs/**`（`docs/deploy/frontend.md` を除く）
- 必須権限（完全一致）:
  - `id-token: write`
  - `contents: read`
- 必須実行環境:
  - `runs-on: ubuntu-latest`
  - Node `20`
- 必須ステップ名:
  - `Checkout`
  - `Setup Node`
  - `Install dependencies`
  - `Build frontend`
  - `Configure AWS credentials`
  - `Deploy placeholder (Issue 2)`
- ドキュメント必須記載:
  - `AWS_ROLE_ARN_FRONTEND_DEPLOY`
  - `AWS_REGION`
  - `S3_BUCKET_FRONTEND`（Issue 2で必須化）
  - `CLOUDFRONT_DISTRIBUTION_ID`（Issue 2で必須化）

---

## 5. ACトレース

- AC-01: `frontend` 変更を含む `main` push でワークフロー実行 + `Install dependencies` / `Build frontend` 成功
- AC-02: OIDC設定済みで `Configure AWS credentials` 成功
- AC-03: `docs/deploy/frontend.md` にSecrets/Variables設定が文書化
- AC-04: `AWS_ROLE_ARN_FRONTEND_DEPLOY` 未設定時に認証ステップ失敗
- AC-05: 依存不整合時に `Install dependencies` で停止
- AC-06: ビルド不能時に `Build frontend` で停止
- AC-07: 連続push時に同時実行抑止（`cancel-in-progress: false`）
- AC-08: ワークフロー定義ファイルのみ変更時にも起動
- AC-09: `frontend` 外のみ変更では起動しない

---

## 6. テスト設計（RED）

### 6.1 Static Test: `frontend/tests/workflow/deployFrontendWorkflow.red.test.ts`

- ST-01: ワークフローファイル存在
  - コメント: `// 何を検証するか: deploy-frontend.yml が規定パスに存在すること`
- ST-02: トリガー定義
  - コメント: `// 何を検証するか: push(main) と workflow_dispatch が定義されていること`
- ST-03: パス条件（対象）
  - コメント: `// 何を検証するか: frontend/** と workflowファイル変更時のみ起動条件が定義されていること`
- ST-04: パス条件（非対象）
  - コメント: `// 何を検証するか: backend/** など非対象変更のみでは起動しない設計になっていること`
- ST-05: concurrency定義
  - コメント: `// 何を検証するか: group と cancel-in-progress=false が設定されていること`
- ST-06: permissions最小権限
  - コメント: `// 何を検証するか: permissionsキーが id-token と contents の完全一致であること`
- ST-07: Node/Build手順
  - コメント: `// 何を検証するか: Setup Node(20) 後に npm ci と npm run build が frontend 配下で実行されること`
- ST-08: AWS認証ステップ
  - コメント: `// 何を検証するか: configure-aws-credentials によるOIDC認証ステップがあること`
- ST-09: ダミーデプロイ接続点
  - コメント: `// 何を検証するか: Deploy placeholder (Issue 2) が定義されていること`

### 6.2 Static Test: `frontend/tests/workflow/deployFrontendDocs.red.test.ts`

- SD-01: ドキュメントファイル存在
  - コメント: `// 何を検証するか: docs/deploy/frontend.md が存在すること`
- SD-02: 必須設定値の文書化
  - コメント: `// 何を検証するか: AWS_ROLE_ARN_FRONTEND_DEPLOY と AWS_REGION の設定手順が記載されていること`
- SD-03: Issue 2予約値の記載
  - コメント: `// 何を検証するか: S3_BUCKET_FRONTEND と CLOUDFRONT_DISTRIBUTION_ID が Issue 2で必須化と明記されていること`

### 6.3 Simulated Runtime Test: `frontend/tests/workflow/deployFrontendRuntime.red.test.ts`

- RT-01: 認証失敗時の停止位置
  - コメント: `// 何を検証するか: AWS_ROLE_ARN_FRONTEND_DEPLOY 未設定時の失敗ステップが Configure AWS credentials であること`
- RT-02: 依存解決失敗時の停止位置
  - コメント: `// 何を検証するか: npm ci 失敗時に Build frontend へ進まず停止すること`
- RT-03: ビルド失敗時の停止位置
  - コメント: `// 何を検証するか: npm run build 失敗時に Deploy placeholder へ進まず停止すること`

注記:
- RED段階ではワークフロー未実装を前提とし、ST/SD/RTの複数ケースが失敗する想定

---

## 7. AC-IDとテストID対応表

- AC-01: ST-02, ST-03, ST-07
- AC-02: ST-08, RT-01
- AC-03: SD-01, SD-02, SD-03
- AC-04: RT-01
- AC-05: RT-02
- AC-06: RT-03
- AC-07: ST-05
- AC-08: ST-03
- AC-09: ST-04

---

## 8. 実装ルール（テストコード規約）

- 各 `it` の直前に `何を検証するか` 日本語コメントを記述する
- テスト名は日本語で期待動作を明示する
- YAMLは文字列grepではなく構造パースで検証する
- 失敗メッセージは不足キー名を含め、1回で原因特定できる文言にする
- RED段階では環境依存の外部疎通を避け、静的検証と擬似実行を主軸にする

---

## 9. RED実行手順

`frontend` で実行:

1. 依存インストール
   - `npm ci`
2. ワークフロー静的REDテスト
   - `npx vitest run tests/workflow/deployFrontendWorkflow.red.test.ts tests/workflow/deployFrontendDocs.red.test.ts`
3. 擬似実行REDテスト
   - `npx vitest run tests/workflow/deployFrontendRuntime.red.test.ts`

証跡:

- 初回実行でAC対応テストが3件以上失敗することを確認する
- 失敗理由が仕様未実装または仕様不一致であることをログで確認する
- 環境起因失敗が0件であることを確認する

---

## 10. 完了条件（RED）

- ACをカバーするREDテストが追加されている
- すべてのテストに `何を検証するか` コメントが付いている
- RED実行で有効な失敗（仕様未実装/不一致）が確認できる
- 無効な失敗（構文/実行環境不備）が0件である

---

## 11. コミット方針

コミットメッセージ（Issue番号必須）:

`test: E14-01 workflow REDテスト計画を追加 #66`

コミット本文（例）:

- E14-01/E14-05の受入条件をREDテスト観点へ分解
- ワークフロー定義、設定ドキュメント、擬似実行のRED計画を追加
- 各テストケースへ「何を検証するか」コメント付与ルールを明記

---

## 12. 運用

- 本計画の正本: `.github/E14-01_FRONTEND_AUTO_DEPLOY_WORKFLOW_RED_TEST_PLAN.md`
- レビュー反映時は本ファイルを上書き更新する
- 本Issueは `#66` を参照する
````
