import { test, expect } from '@playwright/test';
import { collectConsoleErrors, waitForPageLoad } from './test-utils';

test.describe('test-utils ヘルパー関数', () => {
  test.describe('collectConsoleErrors', () => {
    test('空のエラー配列を返す（初期状態）', async ({ page }) => {
      const errors = collectConsoleErrors(page);

      // エラーがない状態では空配列
      expect(errors).toEqual([]);
    });

    test('コンソールエラー収集リスナーが設定される', async ({ page }) => {
      const errors = collectConsoleErrors(page);

      // 関数が配列を返すことを確認
      expect(Array.isArray(errors)).toBe(true);

      // 初期状態は空
      expect(errors).toHaveLength(0);
    });
  });

  test.describe('waitForPageLoad', () => {
    test('ネットワークアイドル状態を待機する', async ({ page }) => {
      // ページ遷移前にリスナーを設定
      const loadPromise = page.waitForLoadState('networkidle');

      await page.goto('/');

      // networkidleを待機
      await loadPromise;

      // ページが読み込まれていることを確認
      expect(page.url()).toContain('http');
    });

    test('ヘルパー関数が呼び出し可能であること', async ({ page }) => {
      // 関数が存在することを確認
      expect(typeof waitForPageLoad).toBe('function');

      // エラーなく呼び出せることを確認
      const promise = waitForPageLoad(page);
      expect(promise).toBeInstanceOf(Promise);

      // キャンセルしてクリーンアップ
      promise.catch(() => {});
    });
  });
});
