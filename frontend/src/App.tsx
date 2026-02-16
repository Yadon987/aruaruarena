import { FormEvent, KeyboardEvent, useRef, useState } from 'react'
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
const LEGACY_STORAGE_KEY = 'aruaruarena_my_posts'
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

function parsePostIds(rawValue: string | null): string[] {
  if (!rawValue) return []
  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id) => typeof id === 'string').slice(0, MAX_STORED_POST_IDS)
  } catch {
    return []
  }
}

function readPostIds(): string[] {
  const rawValue = localStorage.getItem(STORAGE_KEY)
  if (rawValue) {
    return parsePostIds(rawValue)
  }

  const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY)
  const migrated = parsePostIds(legacyValue)
  if (legacyValue) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  return migrated
}

function writePostIds(postIds: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(postIds.slice(0, MAX_STORED_POST_IDS)))
}

function savePostId(id: string) {
  const current = readPostIds()
  const deduplicated = current.filter((existingId) => existingId !== id)
  const limited = [id, ...deduplicated].slice(0, MAX_STORED_POST_IDS)
  writePostIds(limited)
}

function removePostId(id: string) {
  const current = readPostIds()
  const removed = current.filter((existingId) => existingId !== id)
  writePostIds(removed)
}

function resolvePostDetailErrorMessage(error: unknown): string {
  const errorStatus =
    error instanceof ApiClientError ? error.status : (error as { status?: number })?.status

  if (errorStatus === HTTP_STATUS.NOT_FOUND) {
    return '投稿が見つかりませんでした'
  }
  if (errorStatus === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return 'アクセスが集中しています。時間をおいて再度お試しください'
  }
  if (errorStatus && SERVER_ERROR_STATUSES.includes(errorStatus)) {
    return '一時的なエラーです。時間をおいて再試行してください'
  }

  return 'ネットワーク接続を確認してください'
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

function RankingSection({ myPostIds }: { myPostIds: string[] }) {
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
            <li
              key={item.id}
              data-testid="ranking-item"
              className={`rounded border p-3 ${myPostIds.includes(item.id) ? 'bg-yellow-100 border-l-4 border-l-red-500' : ''}`}
            >
              <p className="font-semibold">{item.rank}位 {item.nickname}</p>
              <p>{item.body}</p>
              <p className="text-sm text-gray-600">平均スコア: {item.average_score.toFixed(1)}</p>
              {myPostIds.includes(item.id) && <p className="text-sm font-bold">あなたの投稿</p>}
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
  const [myPostIds, setMyPostIds] = useState<string[]>(() => readPostIds())
  const [isMyPostsOpen, setIsMyPostsOpen] = useState(false)
  const [myPostsError, setMyPostsError] = useState('')
  const inFlightPostIdsRef = useRef<Set<string>>(new Set())

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
      setMyPostIds(readPostIds())
      setNickname('')
      setBody('')
      setSuccessMessage(MESSAGE_SUCCESS)
    } catch (error) {
      setSubmitError(resolveSubmitErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openMyPosts = () => {
    setMyPostIds(readPostIds())
    setIsMyPostsOpen(true)
  }

  const closeMyPosts = () => {
    setIsMyPostsOpen(false)
  }

  const handleMyPostsTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMyPosts()
    }
  }

  const handleMyPostClick = async (postId: string) => {
    if (inFlightPostIdsRef.current.has(postId)) {
      return
    }

    inFlightPostIdsRef.current.add(postId)
    setMyPostsError('')
    const previousPostIds = readPostIds()
    removePostId(postId)
    setMyPostIds(readPostIds())
    try {
      await api.posts.get(postId)
      writePostIds(previousPostIds)
      setMyPostIds(readPostIds())
    } catch (error) {
      const message = resolvePostDetailErrorMessage(error)
      setMyPostsError(message)
      const status =
        error instanceof ApiClientError ? error.status : (error as { status?: number })?.status
      if (status !== HTTP_STATUS.NOT_FOUND) {
        writePostIds(previousPostIds)
        setMyPostIds(readPostIds())
      }
    } finally {
      inFlightPostIdsRef.current.delete(postId)
    }
  }

  const displayMyPostIds = Array.from(new Set(myPostIds)).slice(0, MAX_STORED_POST_IDS)

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

        <RankingSection myPostIds={myPostIds} />

        <footer role="contentinfo">
          <button type="button" onClick={openMyPosts} onKeyDown={handleMyPostsTriggerKeyDown}>
            自分の投稿一覧
          </button>
          <p>フッター</p>
        </footer>

        {isMyPostsOpen && (
          <div
            role="dialog"
            aria-label="自分の投稿"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMyPosts()
            }}
          >
            <div className="w-full max-w-md rounded bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold">自分の投稿</h2>
              {myPostsError && <p className="mb-3">{myPostsError}</p>}
              {displayMyPostIds.length === 0 ? (
                <p>投稿するとここに表示されます</p>
              ) : (
                <ul className="space-y-2">
                  {displayMyPostIds.map((postId) => (
                    <li key={postId} data-testid="my-post-id-item">
                      <button type="button" onClick={() => handleMyPostClick(postId)}>
                        {postId}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={closeMyPosts} className="mt-4">
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
