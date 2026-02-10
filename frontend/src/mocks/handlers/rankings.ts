/**
 * Rankings API ハンドラー
 *
 * ランキング取得のハンドラーを定義します。
 */
import { http, HttpResponse } from 'msw'
import { RANKING } from './constants'
import { createMockRankings } from './helpers'

export const rankingsHandlers = [
  /**
   * GET /api/rankings
   *
   * ランキング一覧を取得します。
   */
  http.get('/api/rankings', () => {
    return HttpResponse.json(createMockRankings(RANKING.DEFAULT_COUNT))
  }),
]
