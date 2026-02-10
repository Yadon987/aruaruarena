import { test as base } from '@playwright/test';

// カスタムフィクスチャ（E12-E14の実装時に拡張予定）
// 現時点では基本のtestをそのままエクスポート
export const test = base.extend<{
  // 将来的な拡張用
  // mockApi: MockApi  // MSW連携（E04-09で追加）
}>({});

export { expect } from '@playwright/test';
