import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import {
  DEFAULT_RANKING_LIMIT,
  MAX_RANKING_LIMIT,
} from './shared/constants/query'
import { HTTP_STATUS } from './shared/constants/api'
import { useRankings } from './shared/hooks/useRankings'
import { ApiClientError } from './shared/services/api'
import type { RankingItem } from './shared/types/domain'
import './App.css'

const ERROR_MESSAGES = {
  rateLimited: 'アクセスが集中しています。しばらく待ってから再度お試しください。',
  failed: '取得に失敗しました。時間をおいて再度お試しください。',
  network: '通信状況を確認して再度お試しください。',
} as const

/**
 * 表示件数は仕様上TOP20固定。
 * APIが多く返しても描画は20件までに制限する。
 */
function buildDisplayRankings(rankings: RankingItem[] | undefined): RankingItem[] {
  if (!Array.isArray(rankings)) {
    return []
  }

  return rankings.slice(0, MAX_RANKING_LIMIT)
}

/**
 * ユーザー向け文言のみ返し、内部エラー詳細は画面に出さない。
 */
function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return ERROR_MESSAGES.rateLimited
    }

    if (error.status === 0) {
      return ERROR_MESSAGES.network
    }
  }

  return ERROR_MESSAGES.failed
}

function RankingSection() {
  const { data, isLoading, isError, error } = useRankings(DEFAULT_RANKING_LIMIT, {
    polling: true,
  })
  const displayRankings = buildDisplayRankings(data?.rankings)

  return (
    <section aria-label="ランキング表示エリア" className="mb-8 rounded border p-4">
      <h2 className="mb-4 text-xl font-bold text-gray-800">あるあるランキング</h2>

      {isLoading && <p>ランキングを読み込み中です...</p>}

      {isError && <p>{resolveErrorMessage(error)}</p>}

      {!isLoading && !isError && displayRankings.length === 0 && (
        <p>ランキングはまだありません</p>
      )}

      {!isLoading && !isError && displayRankings.length > 0 && (
        <ol className="space-y-2">
          {displayRankings.map((item) => (
            <li key={item.id} data-testid="ranking-item" className="rounded border p-3">
              <p className="font-semibold">{item.rank}位 {item.nickname}</p>
              <p>{item.body}</p>
              <p className="text-sm text-gray-600">平均スコア: {item.average_score.toFixed(1)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="p-6">
        <RankingSection />
      </main>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
