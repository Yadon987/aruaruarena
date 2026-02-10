import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2Eテスト設定
 *
 * CI環境とローカル環境で最適な設定を自動切り替え
 */
export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',

  // 並列実行無効（CI安定性のため）
  fullyParallel: false,

  // CI環境で2回、ローカルで0回リトライ
  retries: process.env.CI ? 2 : 0,

  // CI環境で1ワーカー、ローカルでは未定義（デフォルト）
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: [
    ['html'],
    ['blob', { outputFile: 'blob-report/report.json' }],
  ],

  // 共通設定
  use: {
    // 失敗時のみスクリーンショット保存
    screenshot: 'only-on-failure',

    // 最初のリトライ時のみトレース保存
    trace: 'on-first-retry',

    // タイムアウト設定
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },

  // Vite dev server を自動起動
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  // テスト対象プロジェクト
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
