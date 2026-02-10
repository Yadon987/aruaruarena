import { test, expect } from './fixtures/test-fixtures';

test.describe('異常系テスト', () => {
  test('存在しないページへのアクセスで適切なエラー表示', async ({ page }) => {
    // 検証: 存在しないページへのアクセスで適切なエラー表示（テスト計画 異常系1）
    const response = await page.goto('/non-existent-page');
    // SPAの場合、404を返すか、クライアントサイドで404ページを出すかによるが、
    // 現状は実装詳細不明なので、まずはステータスコードか要素をチェック
    // ここでは一般的な "Not Found" テキストが含まれるかなどで検証
    // ただしREDテストなので、失敗すればOK
    expect(response?.status()).toBe(404);
  });

  test('テスト失敗時にスクリーンショットとトレースが保存される', async ({ page }, testInfo) => {
    // 検証: テスト失敗時にスクリーンショットとトレースが保存される（AC異常系1）
    // このテスト自体は設定の確認に近いが、実行結果のアーティファクトを確認するのはCIの役割でもある。
    // ここでは、設定ファイルで screenshot: 'only-on-failure' となっていることを
    // 擬似的に確認する（設定ファイル自体のテストは config-validation で行う）
    
    expect(testInfo.project.use.screenshot).toBe('only-on-failure');
    expect(testInfo.project.use.trace).toBe('on-first-retry');
  });

  test('Vite dev server 起動不可時にタイムアウトエラーが発生する', async () => {
    // 検証: 設定ファイルで webServer.timeout が適切に設定されている（AC異常系2）
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    // ESモジュールで__dirnameを再現
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const configPath = path.join(__dirname, '../playwright.config.ts');
    const configContent = fs.readFileSync(configPath, 'utf-8');

    // 120秒のタイムアウト設定が含まれていることを確認
    expect(configContent).toContain('TIMEOUT_WEB_SERVER');
    expect(configContent).toContain('120 * 1000');
  });
});
