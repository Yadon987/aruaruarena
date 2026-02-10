import { test, expect } from './fixtures/test-fixtures';
import { collectConsoleErrors } from './helpers/test-utils';

test.describe('スモークテスト', () => {
  test('Playwright がスモークテストを実行できる', async () => {
    // 検証: @playwright/test がインストールされている状態で
    // npm run test:e2e を実行するとスモークテストが実行・成功する（AC正常系1）
    expect(true).toBe(true);
  });

  test('トップページが正常に表示される', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    // 検証: ページの初回読み込みが5秒以内に完了する（テスト計画 境界値2）
    // 検証: トップページにアクセスできる（HTTP 200）（テスト計画 正常系1）
    const response = await page.goto('/', { timeout: 5000 });
    expect(response?.status()).toBe(200);

    // 検証: ページタイトルが正しく表示される（テスト計画 正常系2）
    // HTMLのタイトルタグを確認（index.htmlより「あるあるアリーナ」）
    await expect(page).toHaveTitle('あるあるアリーナ');

    // 検証: JavaScriptコンソールにエラーが出ていない（テスト計画 境界値1）
    expect(consoleErrors).toEqual([]);
  });
});
