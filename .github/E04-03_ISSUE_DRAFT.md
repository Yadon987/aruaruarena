---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E04-03: ESLint / Prettier の設定'
labels: 'spec, E04, frontend'
assignees: ''
---

## 📋 概要

フロントエンドプロジェクト（React + Vite + TypeScript）にESLintとPrettierを導入し、コード品質とフォーマットの一貫性を確保する。

## 🎯 目的

- **コード品質**: ESLintによる静的解析で潜在的なバグやコードの問題を検出
- **フォーマット一貫性**: Prettierによる自動フォーマットでチーム内のコードスタイル統一
- **開発体験**: VSCode連携により保存時の自動フォーマットとリントを実現
- **TypeScript対応**: 型安全な開発をサポートする適切なルール設定

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P0（最優先） |
| 影響範囲 | 新機能（フロントエンド基盤） |
| 想定リリース | Sprint 1 / v0.1.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 1.5h |

---

## 📝 詳細仕様

### 機能要件

- **ESLint v8系**の導入（v9はFlat Config移行中のため安定版を採用）:
  - `eslint`本体
  - `@typescript-eslint/parser`（TypeScriptパーサー）
  - `@typescript-eslint/eslint-plugin`（TypeScriptルール）
  - `eslint-plugin-react`（Reactルール）
  - `eslint-plugin-react-hooks`（React Hooksルール）
  - `eslint-plugin-jsx-a11y`（アクセシビリティルール）
  - `eslint-plugin-import`（インポート/エクスポートルール）

- **Prettier**の導入:
  - `prettier`本体
  - `eslint-config-prettier`（ESLintとPrettierの競合回避）
  - `eslint-plugin-prettier`（PrettierのルールをESLintで実行）

- 設定ファイル:
  - `.eslintrc.cjs`（ESLint設定）
  - `.prettierrc`（Prettier設定）
  - `.prettierignore`（Prettier除外ファイル: `.env*`, `dist/`, `node_modules/`）
  - `.eslintignore`（ESLint除外ファイル: 同上）

- npm scripts:
  - `lint`: ESLint実行
  - `lint:fix`: ESLint自動修正
  - `format`: Prettierフォーマット実行
  - `format:check`: フォーマット確認（CI用）

- VSCode連携（[.vscode/settings.json](cci:7://file:///home/nukon/ws/aruaruarena/.vscode/settings.json:0:0-0:0)）:
  - 推奨拡張機能: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`
  - 保存時自動フォーマット: `"editor.formatOnSave": true`
  - 保存時自動リント: `"editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }`
  - デフォルトフォーマッタ: `"editor.defaultFormatter": "esbenp.prettier-vscode"`

### 非機能要件

- **パフォーマンス**:
  - リント/フォーマット処理が3秒以内に完了すること（ソースファイル100個以下の場合）
  - 測定コマンド: `time npm run lint` / `time npm run format`
- **開発体験**: エディターとの統合により、開発者が意識せず一貫性を維持できる
- **互換性**: 既存コードとの互換性を維持（既存コードもフォーマット可能）
- **CI統合**: GitHub Actionsで自動チェック可能

### 国際化対応（i18n）

- [x] エラーメッセージのi18n対応（該当なし）
- [x] 日時フォーマットのタイムゾーン考慮（該当なし）
- [x] 文字エンコーディング（UTF-8）の確認
- 対応言語: 日本語優先、将来英語対応予定

### UI/UX設計

- **エディター体験**: 保存時に自動フォーマットされ、開発者はコードに集中できる
- **フィードバック**: エディター上でリアルタイムにリントエラーを表示
- **CI/CD**: プルリクエスト時に自動チェックされ、品質を担保

---

## 🗺️ Example Mapping（ルールと具体例）

| ルール | Given（前提条件） | When（操作） | Then（期待結果） |
|--------|------------------|-------------|-----------------|
| ESLintが導入されている | プロジェクトにESLintがインストールされている | `npm run lint`を実行 | リントチェックが実行される |
| 未使用の変数が検出される | `const unused = 1;`というコードがある | `npm run lint`を実行 | 「'unused' is assigned a value but never used」エラーが表示される |
| Prettierがフォーマットできる | インデントが不揃いなコードがある | `npm run format`を実行 | コードが一貫したスタイルにフォーマットされる |
| 保存時自動フォーマットが動作 | VSCodeでファイルを編集して保存する | ファイルを保存する | 自動的にPrettierがフォーマットを実行する |
| ESLintとPrettierが競合しない | 両方が設定されている | コードをフォーマットしてリントする | エラーなく両方が動作する |
| CIでリントチェックが動作 | プルリクエストを作成する | GitHub Actionsが実行される | ESLintエラーがあるとCIが失敗する |
| インポート順序が整列される | インポート順序がバラバラなコード | `npm run lint:fix`を実行 | インポートが規則に従って整列される |
| 新規TSXファイルにルール適用 | 新しいReactコンポーネントを作成 | `npm run lint`を実行 | React/TypeScriptルールが適用される |

---

## 🔧 技術仕様

### データモデル (DynamoDB)

該当なし（フロントエンドのみの変更）

### 後方互換性

- [x] 既存APIのレスポンス形式を変更しない（該当なし）
- [x] 既存のクライアント（フロントエンド）への影響なし
- [x] データマイグレーション不要
- 破壊的変更がある場合の対応策: なし

### API設計

該当なし（フロントエンドのみの変更）

### エラーハンドリング仕様

該当なし（フロントエンドのみの変更）

### セキュリティ仕様

#### 認証・認可

- 認証方式: なし（リンター/フォーマッタのみ）
- 必要な権限レベル: なし
- 権限チェックのタイミング: なし

#### バリデーション

- 入力値検証ルール: なし
  - [x] 文字数制限
  - [x] 形式チェック（正規表現）
  - [x] サニタイズ処理
  - [x] ホワイトリスト/ブラックリスト

#### 除外ファイル（機密情報保護）

- `.env`, `.env.*` をリンター/フォーマッタ対象外とする
- `dist/`, `node_modules/` を対象外とする

#### レート制限

- 制限対象: なし
- 制限値: -
- 制限期間: -
- 制限超過時の挙動: -

#### STRIDE脅威対策

- [x] Spoofing（なりすまし）対策: 該当なし
- [x] Tampering（改ざん）対策: 該当なし
- [x] Repudiation（否認）対策: 該当なし
- [x] Information Disclosure（情報漏洩）対策: `.env`ファイルを除外設定
- [x] Denial of Service（サービス拒否）対策: 該当なし
- [x] Elevation of Privilege（権限昇格）対策: 該当なし

### データ保持・プライバシー

- データ保持期間: なし（ローカルツールのみ）
- 個人情報の取り扱い: なし
  - [x] GDPR/個人情報保護法への準拠確認
  - [x] 削除リクエスト対応の必要性
- ログからの個人情報マスキング: 該当なし

### パフォーマンス要件

#### N+1クエリ対策

- [x] includes/preload/eager_loadの使用箇所: 該当なし（フロントエンド）
- [x] 対象のアソシエーション: -

#### DynamoDB最適化

- [x] バッチ処理の使用: -
- [x] キャッシュ戦略: -
- [x] 読み込み整合性: -

#### 想定負荷

- 想定ファイル数: 100ファイル以下
- レスポンスタイム目標:
  - ESLint: 3秒以内（100ファイル以下の場合）
  - Prettier: 2秒以内（100ファイル以下の場合）
  - 測定方法: `time npm run lint` / `time npm run format`

### 障害復旧・耐障害性

- SLO目標:
  - 可用性: 99.x%（該当なし）
  - レイテンシ: p99 < Xms（該当なし）
- 障害発生時の挙動:
  - [x] グレースフルデグラデーション
  - [x] サーキットブレーカー
  - [x] リトライ戦略
- 復旧手順: -

### 外部API連携仕様

該当なし（フロントエンドのみの変更）

### トランザクション設計

該当なし（フロントエンドのみの変更）

### 並行処理・競合制御

- 競合が発生するケース: なし
- 競合制御の方法: -
- ロック戦略: -

### ログ出力仕様

該当なし（フロントエンドのみの変更）

### モニタリング・アラート

- 監視メトリクス:
  - [x] レスポンスタイム
  - [x] エラー率
  - [x] レート制限超過回数
  - [x] 外部API呼び出し失敗率
- アラート条件: -
- アラート通知先: -

### 分散トレーシング

- [x] トレースIDの伝播
- スパンの定義:
  - スパン名: -
  - 含める属性: -

### カスタムメトリクス

該当なし

### AIプロンプト設計

該当なし

---

## 🚫 実装時の禁止事項チェックリスト

実装時に以下を遵守すること：
- [x] `.permit!` を使用していない（バックエンドのみ）
- [x] N+1クエリが発生しない（バックエンドのみ）
- [x] トランザクションなしで複数DB操作していない（バックエンドのみ）
- [x] 機密情報（APIキー、パスワード）をハードコードしていない
- [ ] **テストなしで機能を実装していない**（リント/フォーマットの検証を実施）
- [x] `binding.pry` を本番コードに残していない
- [x] コメント・コミットメッセージは日本語で記述

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)

該当なし（フロントエンドのみの変更）

### Request Spec (API)

該当なし（フロントエンドのみの変更）

### Integration Test (結合テスト)

- [x] 外部サービスとの連携テスト: 該当なし
- [ ] **検証シナリオ**:
  - `npm run lint`実行でエラーがないこと（既存コード）
  - `npm run format`実行でフォーマットが適用されること
  - `npm run lint:fix`実行で自動修正が動作すること
  - `npm run format:check`でフォーマット済みなら成功すること
  - インポート順序が`eslint-plugin-import`により整列されること

### External Service (WebMock/VCR)

- [x] モック対象: なし

### Performance Test (負荷テスト)

- [x] 負荷テストシナリオ: 該当なし
- [x] 目標スループット: -
- [x] 目標レイテンシ: -

### カバレッジ目標

- [ ] **カバレッジ90%以上を達成**: 該当なし（リンター/フォーマッタのみ）

**フロントエンド検証用チェックリスト**:
- [ ] ESLintがインストールされ、設定ファイルが作成されている
- [ ] `npm run lint`でリントチェックが実行できる
- [ ] `npm run lint:fix`で自動修正が実行できる
- [ ] Prettierがインストールされ、設定ファイルが作成されている
- [ ] `npm run format`でフォーマットが実行できる
- [ ] `npm run format:check`でフォーマット済みか確認できる
- [ ] VSCodeのsettings.jsonが作成され、保存時フォーマットが有効になっている
- [ ] VSCode拡張機能の推奨設定（`.vscode/extensions.json`）が作成されている

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** Viteプロジェクトが作成されている（E04-01完了）
      **When** ESLintとPrettierのインストールと設定が完了している
      **Then** `npm run lint`と`npm run format`が正常に実行できる

- [ ] **Given** フォーマットされていないコードがある
      **When** `npm run format`を実行する
      **Then** コードが一貫したスタイルにフォーマットされる

- [ ] **Given** ESLintエラーを含むコードがある（例：未使用変数）
      **When** `npm run lint`を実行する
      **Then** 適切なエラーメッセージが表示される

- [ ] **Given** VSCodeでファイルを編集して保存する
      **When** 保存操作を行う
      **Then** 自動的にPrettierがフォーマットを実行する

- [ ] **Given** ESLintとPrettierが設定されている
      **When** 両方を実行する
      **Then** ルールの競合なく正常に動作する

### 異常系 (Error Path)

- [ ] **Given** ESLint設定ファイルに構文エラーがある
      **When** `npm run lint`を実行する
      **Then** 適切なエラーメッセージが表示され、実行が失敗する

- [ ] **Given** Prettier設定ファイルに無効な設定がある
      **When** `npm run format`を実行する
      **Then** エラーが発生し、問題箇所が特定できる

- [ ] **Given** CIでリントエラーがある
      **When** GitHub Actionsが実行される
      **Then** CIが失敗し、修正を促すメッセージが表示される

### 境界値 (Edge Case)

- [ ] **Given** 100ファイル以下のプロジェクト
      **When** `npm run lint`と`npm run format`を実行する
      **Then** 各3秒以内に処理が完了する

- [ ] **Given** TypeScriptの型に関するエラーがある
      **When** `npm run lint`を実行する
      **Then** `@typescript-eslint`が検出可能な型エラーが報告される（注: 網羅的な型チェックには`tsc --noEmit`を併用）

---

## 🚀 リリース計画

### フィーチャーフラグ

- フラグ名: なし（開発ツールのみ）
- デフォルト値: -
- 有効化条件: -
- 完全有効化後の削除予定: -

### マイグレーション計画

- 既存データへの影響: なし（フロントエンドのみ）
- マイグレーションスクリプト: なし
- ロールバック手順: 設定ファイルとパッケージを削除

### ロールアウト戦略

- リリース方法: 即時適用（開発ツールのみ）
- ロールバック条件: チームの生産性低下、既存コードとの互換性問題
- 緊急停止手順: `.eslintrc.cjs`と`.prettierrc`を削除し、パッケージをアンインストール

### ドキュメント更新

- [x] API仕様書（OpenAPI/Swagger）の更新: 該当なし
- [ ] **README.mdの更新**: ESLint/Prettierの使用方法を記載
- [ ] **VSCode拡張機能の推奨設定を追加**: `.vscode/extensions.json`
- [x] 運用手順書の更新: 該当なし
- [x] ユーザー向けヘルプの更新: 該当なし

### CI統合

- [ ] [.github/workflows/test.yml](cci:7://file:///home/nukon/ws/aruaruarena/.github/workflows/test.yml:0:0-0:0) に以下を追加:
  - `npm run lint` ステップ
  - `npm run format:check` ステップ

### 依存関係

- 前提条件となるIssue: #E04-01（Viteプロジェクトの作成）✅ 完了、#E04-02（Tailwind CSSの導入）
- ブロッカーとなるIssue: なし
- 関連するIssue: #E04-04（ディレクトリ構成の整備）

---

## 🔗 関連資料

- ESLint公式ドキュメント: [https://eslint.org/docs/latest/](https://eslint.org/docs/latest/)
- TypeScript ESLint: [https://typescript-eslint.io/](https://typescript-eslint.io/)
- Prettier公式ドキュメント: [https://prettier.io/docs/en/](https://prettier.io/docs/en/)
- ESLint + Prettier共存ガイド: [https://prettier.io/docs/en/integrating-with-linters/](https://prettier.io/docs/en/integrating-with-linters/)
- VSCode拡張:
  - ESLint: `dbaeumer.vscode-eslint`
  - Prettier: `esbenp.prettier-vscode`

---

## 📊 Phase 2完了チェック（技術設計確定）

- [x] AIとの壁打ち設計を完了
- [x] 設計レビューを実施
- [x] 全ての不明点を解決
- [x] このIssueに技術仕様を書き戻し完了

---

**レビュアーへの確認事項:**

- [x] 仕様の目的が明確か
- [x] DynamoDBのキー設計はアクセスパターンに適しているか（該当なし）
- [x] Example Mappingでルールと例が網羅されているか
- [x] セキュリティ要件（認証、認可、バリデーション、レート制限）が明確か（該当なし）
- [x] エラーハンドリングが統一フォーマットに従っているか（該当なし）
- [x] N+1クエリ対策が考慮されているか（該当なし）
- [x] 外部API連携時のタイムアウト・リトライが設計されているか（該当なし）
- [x] トランザクション境界とロールバック戦略が明確か（該当なし）
- [x] テスト計画は正常系/異常系/境界値を網羅しているか
- [x] 受入条件はGiven-When-Then形式で記述されているか
- [x] ログ出力に機密情報が含まれていないか（該当なし）
- [x] CLAUDE.mdの禁止事項を遵守しているか
- [x] 既存機能や他の仕様と矛盾していないか
- [x] 後方互換性が確保されているか（新規プロジェクト）
- [x] フィーチャーフラグによる段階的リリースが検討されているか（該当なし）
- [x] 障害復旧・耐障害性が考慮されているか（該当なし）
- [x] ドキュメント更新計画があるか
- [x] 見積もり工数は妥当か