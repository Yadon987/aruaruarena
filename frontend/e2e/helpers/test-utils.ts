import { Page } from '@playwright/test';

/**
 * ページの読み込み完了を待機するヘルパー関数
 * ネットワークのアイドル状態を待機します
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * コンソールエラーを収集するヘルパー関数
 * テスト実行中のJSエラーを検知するために使用します
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}
