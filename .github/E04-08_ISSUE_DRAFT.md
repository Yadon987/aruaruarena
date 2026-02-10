---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E04-08: Playwrightの導入と設定'
labels: 'spec, E04, frontend, testing'
assignees: ''
---

## 📋 概要

フロントエンドのE2Eテスト基盤を構築する。
Playwrightを導入し、主要ユーザーフローの自動テスト環境を整備する。各画面Epic（E12-E17）で即座にE2Eテストを書ける状態にすることが目標。

## 🎯 目的

- **品質保証の自動化**: ユーザー視点の操作フローを自動テストで保証
- **リグレッション防止**: 新機能追加時に既存機能が壊れていないことを検証
- **CI/CD連携**: GitHub ActionsでE2Eテストを自動実行し、マージ前に品質チェック
- **開発効率の向上**: E12-E17の各画面実装時に即座にE2Eテストを追加可能な基盤を提供

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P1（高） |
| 影響範囲 | 新機能（テスト基盤） |
| 想定リリース | Sprint 1 / v0.1.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 2h |
| 前提条件 | E04-01 完了（Viteプロジェクト） |

---

## 📝 詳細仕様

### 機能要件

#### 1. Playwright のインストールと初期設定

- `@playwright/test` のインストール
- `playwright.config.ts` の作成
  - テスト対象ブラウザ: Chromium のみ（CIリソース節約）
  - baseURL: `http://localhost:5173`（Vite dev server）
  - テストディレクトリ: `frontend/e2e/`
  - スクリーンショット: 失敗時のみ保存
  - トレース: 失敗時のみ保存（`on-first-retry`）
  - タイムアウト: テスト30秒、expect 5秒
- ブラウザバイナリのインストール（`npx playwright install chromium`）

#### 2. ディレクトリ構成

```
frontend/
├── e2e/                          # [NEW] E2Eテスト用ディレクトリ
│   ├── fixtures/                 # [NEW] テスト用フィクスチャ
│   │   └── test-fixtures.ts      # [NEW] 共通フィクスチャ定義
│   ├── helpers/                  # [NEW] テストヘルパー
│   │   └── test-utils.ts         # [NEW] 共通ユーティリティ
│   └── smoke.spec.ts             # [NEW] スモークテスト（基盤動作確認）
├── playwright.config.ts          # [NEW] Playwright設定
└── package.json                  # scripts追加
```

#### 3. npm scripts の追加

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

#### 4. スモークテスト（基盤動作確認用）

- トップページにアクセスしてタイトルが表示されることを確認
- ページが正常に読み込まれることを確認（200レスポンス）
- JavaScript エラーがコンソールに出ていないことを確認

#### 5. 共通フィクスチャの設計

```typescript
// e2e/fixtures/test-fixtures.ts
import { test as base } from '@playwright/test'

// カスタムフィクスチャ（E12-E14の実装時に拡張）
export const test = base.extend<{
  // 将来的な拡張用
  // mockApi: MockApi  // MSW連携（E04-09で追加）
}>({
  // フィクスチャの定義
})

export { expect } from '@playwright/test'
```

#### 6. 共通ヘルパーの設計

```typescript
// e2e/helpers/test-utils.ts

/** ページの読み込み完了を待機する */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}

/** コンソールエラーを収集するヘルパー */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}
```

#### 7. CI/CD 連携（GitHub Actions）

- `.github/workflows/e2e.yml` の作成（または既存CIへの追加）
- dev server の起動と E2E テストの実行を自動化
- テスト失敗時にスクリーンショットとトレースをアーティファクトとして保存

```yaml
# .github/workflows/e2e.yml（概要）
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### 非機能要件

- **実行速度**: スモークテストは10秒以内に完了すること
- **並列実行**: CIでは`workers: 1`（リソース制約）、ローカルでは`workers: undefined`（自動検出）
- **レポート**: HTML レポートを生成し、失敗テストの詳細を確認可能
- **安定性**: フレーキーテスト（不安定なテスト）を防ぐため、適切な待機戦略を使用
- **.gitignore**: `test-results/`、`playwright-report/`、`blob-report/` を除外

### UI/UX設計

N/A（テスト基盤のみ、実際の画面テストはE12-E17で実施）

---

## 🔧 技術仕様

### パッケージ追加

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Playwright 設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

### データモデル (DynamoDB)

N/A（フロントエンド基盤のみ）

### API設計

N/A

### AIプロンプト設計

N/A

---

## 🧪 テスト計画 (TDD)

### Unit Test

N/A（E2Eテスト基盤の導入のため、ユニットテスト対象なし）

### E2Eテスト（Playwright）

- [ ] 正常系: トップページにアクセスできる（HTTP 200）
- [ ] 正常系: ページタイトルが正しく表示される
- [ ] 正常系: Vite dev server が自動起動する（webServer設定）
- [ ] 異常系: 存在しないページへのアクセスで適切なエラー表示
- [ ] 境界値: JavaScriptコンソールにエラーが出ていない
- [ ] 境界値: ページの初回読み込みが5秒以内に完了する

### External Service (WebMock/VCR)

N/A（E04-09 MSW導入時にモックサーバー連携を追加）

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** `@playwright/test` がインストールされている
      **When** `npm run test:e2e` を実行する
      **Then** Playwright がスモークテストを実行し、成功する

- [ ] **Given** `playwright.config.ts` が設定されている
      **When** E2Eテストを実行する
      **Then** Vite dev server が自動起動し、テスト完了後に停止する

- [ ] **Given** スモークテストが定義されている
      **When** トップページにアクセスする
      **Then** ページが正常に読み込まれ、タイトルが表示される

- [ ] **Given** `npm run test:e2e:ui` が設定されている
      **When** UIモードを起動する
      **Then** Playwright UIが表示され、テストをインタラクティブに実行できる

### 異常系 (Error Path)

- [ ] **Given** テストが失敗した
      **When** テスト実行が完了する
      **Then** スクリーンショットとトレースが `test-results/` に保存される

- [ ] **Given** Vite dev server が起動できない
      **When** E2Eテストを実行する
      **Then** タイムアウトエラーが発生し、明確なエラーメッセージが表示される

### 境界値 (Edge Case)

- [ ] **Given** CI環境（`process.env.CI === true`）
      **When** E2Eテストを実行する
      **Then** `workers: 1`、`retries: 2` で実行される

- [ ] **Given** ローカル開発環境
      **When** 既にVite dev serverが起動している
      **Then** `reuseExistingServer: true` で既存サーバーを再利用する

- [ ] **Given** `.gitignore` が設定されている
      **When** テストを実行する
      **Then** `test-results/`、`playwright-report/`、`blob-report/` がGitに含まれない

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | REDテスト作成（スモークテスト） | 20分 |
| Phase 2 | GREEN実装（npm install + 設定ファイル） | 40分 |
| Phase 3 | CI/CD連携 | 30分 |
| Phase 4 | REFACTOR & ドキュメント | 15分 |
| Phase 5 | コードレビュー対応 | 15分 |
| **合計** | | **2時間** |

### 依存関係

- 前提条件となるIssue: E04-01（Viteプロジェクト）✅ 完了
- 関連するIssue:
  - E04-09（MSW）: E2Eテストでのモックサーバー連携
  - E12（トップ画面）: `smoke.spec.ts` を拡張、ランキング表示テスト
  - E13（審査中画面）: 審査フローのE2Eテスト
  - E14（審査結果モーダル）: モーダル表示のE2Eテスト
  - E15（自分の投稿一覧）: 投稿一覧表示のE2Eテスト
  - E16（プライバシーポリシー）: モーダル表示のE2Eテスト
  - E17（BGM・SE再生）: オーディオ再生のE2Eテスト

---

## 🔗 関連資料

- Playwright公式ドキュメント: https://playwright.dev/
- Playwright Best Practices: https://playwright.dev/docs/best-practices
- Vite + Playwright 連携: https://playwright.dev/docs/test-webserver
- 画面設計書: `docs/screen_design.md`
- Epics一覧: `docs/epics.md`

---

## 📊 Phase 2完了チェック（技術設計確定）

- [ ] AIとの壁打ち設計を完了
- [ ] 設計レビューを実施
- [ ] 全ての不明点を解決
- [ ] このIssueに技術仕様を書き戻し完了

---

**レビュアーへの確認事項:**

- [ ] 仕様の目的が明確か
- [ ] Playwrightの設定（ブラウザ、タイムアウト、リトライ）は妥当か
- [ ] テストディレクトリ構成は拡張性があるか
- [ ] CI/CDワークフローの設計は適切か
- [ ] スモークテストの内容は基盤検証として十分か
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] E04-09（MSW）との連携方針は明確か
- [ ] `.gitignore` の設定は適切か
