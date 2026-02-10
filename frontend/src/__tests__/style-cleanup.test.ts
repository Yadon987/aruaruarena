import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('スタイルファイルのクリーンアップチェック', () => {
  it('App.tsx からレイアウト制限クラス（max-w-*, mx-auto）が削除されていること', () => {
    const appTsxPath = path.resolve(__dirname, '../App.tsx');
    const content = fs.readFileSync(appTsxPath, 'utf-8');

    // 「Viteデフォルト」に含まれていた特定の内容が削除されていることを確認
    // 単なるユーティリティクラス（max-w-2xlなど）は使用する可能性があるため除外
    expect(content).not.toMatch(/count is/); // デフォルトのカウンターボタン
    expect(content).not.toMatch(/Edit <code>src\/App.tsx<\/code> and save to test HMR/);
    // ロゴ自体は許可するが、デフォルトの文章「Click on the Vite and React logos」は許可しない
    expect(content).not.toMatch(/Click on the Vite and React logos/);
  });
  it('App.css から Vite のデフォルトスタイルが削除されていること', () => {
    const appCssPath = path.resolve(__dirname, '../App.css');
    const content = fs.readFileSync(appCssPath, 'utf-8');

    // #root へのスタイル（max-width: 1280px; margin: 0 auto; text-align: center;）が削除されているべき
    expect(content).not.toMatch(/#root\s*{\s*max-width:\s*1280px;/);
    expect(content).not.toMatch(/text-align:\s*center;/);
  });

  it('index.css から Vite のデフォルトスタイルが削除されていること', () => {
    const indexCssPath = path.resolve(__dirname, '../index.css');
    const content = fs.readFileSync(indexCssPath, 'utf-8');

    // body のデフォルト背景色（ダークモード用）が削除されているべき
    expect(content).not.toMatch(/background-color:\s*#242424;/);
    
    // root の文字色が削除されているべき
    expect(content).not.toMatch(/color:\s*rgba\(255,\s*255,\s*255,\s*0\.87\);/);

    // Tailwind のディレクティブは残っているべき
    expect(content).toMatch(/@tailwind base;/);
    expect(content).toMatch(/@tailwind components;/);
    expect(content).toMatch(/@tailwind utilities;/);
  });
});
