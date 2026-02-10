import { defineConfig } from 'vitest/config'
import { sharedConfig } from './vite.config'

// Vitest用設定: 共通設定＋テスト固有設定
export default defineConfig({
  ...sharedConfig,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // E2Eテスト（Playwright）を除外
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
