import { test, expect } from './fixtures/test-fixtures';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESモジュールで__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('設定検証', () => {
  const configPath = path.join(__dirname, '../playwright.config.ts');

  test('playwright.config.ts が存在し、Vite dev server 設定が含まれている', async () => {
    // 検証: playwright.config.ts が正しく設定され Vite dev server が自動起動（AC正常系2）
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, 'utf-8');
    expect(configContent).toContain("command: 'npm run dev'");
    expect(configContent).toContain("url: 'http://localhost:5173'");
  });

  test('CI環境とローカル環境で設定が適切に分岐されている', async () => {
    // 検証: CI環境で workers: 1、retries: 2 で実行される（AC境界値1）
    // 検証: ローカル環境で reuseExistingServer: true（AC境界値2）

    // configファイルが存在しない場合、readFileSyncでエラーになるため、
    // 上のテストだけでなくここで落ちる可能性もあるが、REDテストとしては問題ない
    const configContent = fs.readFileSync(configPath, 'utf-8');

    // 文字列として設定ロジックが含まれているか確認
    expect(configContent).toContain("workers: process.env.CI ? 1 : undefined");
    expect(configContent).toContain("retries: process.env.CI ? 2 : 0");
    expect(configContent).toContain("reuseExistingServer: !process.env.CI");
  });

  test('npm scripts に test:e2e:ui が含まれている', async () => {
    // 検証: npm run test:e2e:ui でUIモード起動（AC正常系4）
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    expect(packageJson.scripts['test:e2e:ui']).toBe('playwright test --ui');
  });
});
