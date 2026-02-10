/**
 * MSWハンドラー用ヘルパー関数
 *
 * モックデータ生成や共通処理を提供します。
 */
import { MOCK, RANKING } from './constants'

/**
 * モック投稿データを生成する
 *
 * @param overrides - オーバーライドするプロパティ
 * @returns モック投稿データ
 */
export function createMockPost(overrides?: Partial<ReturnType<typeof createMockPost>>) {
  return {
    id: MOCK.UUID_PREFIX + Date.now(),
    nickname: MOCK.DEFAULT_NICKNAME,
    body: MOCK.DEFAULT_BODY,
    status: 'judging' as const,
    created_at: MOCK.TIMESTAMP,
    ...overrides,
  }
}

/**
 * モックランキングデータを生成する
 *
 * @param count - ランキング件数
 * @returns モックランキングデータ
 */
export function createMockRankings(count: number = RANKING.DEFAULT_COUNT) {
  return {
    rankings: Array.from({ length: count }, (_, i) => ({
      rank: i + 1,
      id: String(i + 1),
      nickname: `user${i + 1}`,
      body: `body${i + 1}`,
      average_score: RANKING.SCORES[i] || 80,
    })),
    total_count: count,
  }
}
