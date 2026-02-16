import { FormEvent, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import { HTTP_STATUS } from './shared/constants/api'
import {
  DEFAULT_RANKING_LIMIT,
  MAX_RANKING_LIMIT,
} from './shared/constants/query'
import { useRankings } from './shared/hooks/useRankings'
import { ApiClientError, api } from './shared/services/api'
import type { RankingItem } from './shared/types/domain'
import './App.css'

const STORAGE_KEY = 'my_post_ids'
const MIN_BODY_LENGTH = 3
const MAX_STORED_POST_IDS = 20
const SERVER_ERROR_STATUSES = [
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
]
const MESSAGE_NICKNAME_REQUIRED = 'ニックネームを入力してください'
const MESSAGE_BODY_REQUIRED = '本文は3文字以上で入力してください'
const MESSAGE_SUCCESS = '投稿を受け付けました'
const MESSAGE_RATE_LIMITED = '5分後に再投稿してください'
const MESSAGE_SERVER_ERROR = '一時的なエラーです。時間をおいて再試行してください'
const MESSAGE_DEFAULT_ERROR = 'エラーが発生しました。再試行してください'

const RANKING_ERROR_MESSAGES = {
  rateLimited: 'アクセスが集中しています。しばらく待ってから再度お試しください。',
  failed: '取得に失敗しました。時間をおいて再度お試しください。',
  network: '通信状況を確認して再度お試しください。',
} as const

type ValidationErrors = {
  nicknameError: string
  bodyError: string
}

function readPostIds(): string[] {
  const rawValue = localStorage.getItem(STORAGE_KEY)
  if (!rawValue) return []
  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function savePostId(id: string) {
  const current = readPostIds()
  const deduplicated = current.filter((existingId) => existingId !== id)
  const limited = [id, ...deduplicated].slice(0, MAX_STORED_POST_IDS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limited))
}

function validateForm(nickname: string, body: string): ValidationErrors {
  const trimmedNickname = nickname.trim()
  const trimmedBody = body.trim()
  return {
    nicknameError: trimmedNickname ? '' : MESSAGE_NICKNAME_REQUIRED,
    bodyError: trimmedBody.length >= MIN_BODY_LENGTH ? '' : MESSAGE_BODY_REQUIRED,
  }
}

// APIクライアントの例外種別をUI文言へ変換する
function resolveSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return MESSAGE_RATE_LIMITED
  }
  if (error instanceof ApiClientError && SERVER_ERROR_STATUSES.includes(error.status)) {
    return MESSAGE_SERVER_ERROR
  }
  if (
    error instanceof ApiClientError &&
    ['NETWORK_ERROR', 'TIMEOUT', 'HTTP_ERROR'].includes(error.code)
  ) {
    return MESSAGE_DEFAULT_ERROR
  }
  // APIが返した具体的な文言があれば優先し、未知エラー時のみ汎用文言を使う
  if (error instanceof ApiClientError && error.message && !error.message.startsWith('HTTP ')) {
    return error.message
  }
  return MESSAGE_DEFAULT_ERROR
}

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
function resolveRankingErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return RANKING_ERROR_MESSAGES.rateLimited
    }

    if (error.status === 0) {
      return RANKING_ERROR_MESSAGES.network
    }
  }

  return RANKING_ERROR_MESSAGES.failed
}

function RankingSection() {
  const { data, isLoading, isError, error } = useRankings(DEFAULT_RANKING_LIMIT, {
    polling: true,
  })
  const displayRankings = buildDisplayRankings(data?.rankings)

  return (
    <section role="region" aria-label="ランキング表示エリア" className="mb-4 rounded border p-4">
      <h2 className="mb-4 text-lg font-semibold">ランキング</h2>

      {isLoading && <p>ランキングを読み込み中です...</p>}

      {isError && <p>{resolveRankingErrorMessage(error)}</p>}

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
  const [nickname, setNickname] = useState('')
  const [body, setBody] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [bodyError, setBodyError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const trimmedNickname = nickname.trim()
    const trimmedBody = body.trim()
    const { nicknameError: nextNicknameError, bodyError: nextBodyError } = validateForm(
      trimmedNickname,
      trimmedBody
    )

    setNicknameError(nextNicknameError)
    setBodyError(nextBodyError)
    setSubmitError('')
    setSuccessMessage('')

    if (nextNicknameError || nextBodyError) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await api.posts.create({ nickname: trimmedNickname, body: trimmedBody })
      savePostId(response.id)
      setNickname('')
      setBody('')
      setSuccessMessage(MESSAGE_SUCCESS)
    } catch (error) {
      setSubmitError(resolveSubmitErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-6">
        <header role="banner" className="mb-4">
          <h1 className="text-2xl font-bold">あるあるアリーナ</h1>
        </header>

        <form aria-label="投稿フォーム" onSubmit={onSubmit} className="mb-4 space-y-2">
          <div>
            <label htmlFor="nickname">ニックネーム</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="block w-full border rounded p-2"
            />
            {nicknameError && <p>{nicknameError}</p>}
          </div>
          <div>
            <label htmlFor="body">あるある本文</label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="block w-full border rounded p-2"
            />
            {bodyError && <p>{bodyError}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 border rounded">
            投稿する
          </button>
          {submitError && <p>{submitError}</p>}
          {successMessage && <p>{successMessage}</p>}
        </form>

        <RankingSection />

        <footer role="contentinfo">
          <p>フッター</p>
        </footer>
      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
