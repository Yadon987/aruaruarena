import { test, expect } from './fixtures/test-fixtures';
import fs from 'fs';
import path from 'path';

test.describe('.gitignore 検証', () => {
  test('テスト関連の出力ディレクトリが .gitignore に含まれている', async () => {
    // 検証: test-results/、playwright-report/、blob-report/ がGitに含まれない（AC境界値3）
    const gitignorePath = path.join(__dirname, '../../.gitignore');
    
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');

    expect(gitignoreContent).toContain('test-results/');
    expect(gitignoreContent).toContain('playwright-report/');
    expect(gitignoreContent).toContain('blob-report/');
  });
});
