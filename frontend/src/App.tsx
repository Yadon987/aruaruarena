import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import { API_ERROR_CODE, HTTP_STATUS } from './shared/constants/api'
import { queryKeys } from './shared/constants/queryKeys'
import {
  DEFAULT_RANKING_LIMIT,
  MAX_RANKING_LIMIT,
} from './shared/constants/query'
import { useRankings } from './shared/hooks/useRankings'
import { ApiClientError, api } from './shared/services/api'
import type { Post, RankingItem } from './shared/types/domain'
import { ResultModal } from './features/result'
import { MyPostDetail } from './features/top/components/MyPostDetail'
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
const MESSAGE_POST_NOT_FOUND = '投稿が見つかりませんでした'
const MESSAGE_POST_DETAIL_RATE_LIMITED = 'アクセスが集中しています。時間をおいて再度お試しください'
const MESSAGE_POST_DETAIL_SERVER_ERROR = '一時的なエラーです。時間をおいて再試行してください'
const MESSAGE_POST_DETAIL_NETWORK_ERROR = 'ネットワーク接続を確認してください'
const MESSAGE_JUDGING_FETCH_FAILED = '投稿情報の取得に失敗しました。トップへ戻って再度お試しください。'
const MESSAGE_JUDGING_LOADING = 'AI審査員が採点中...'
const MESSAGE_JUDGING_BODY_FALLBACK = '投稿内容を読み込み中です'
const MESSAGE_JUDGING_NICKNAME_FALLBACK = '名無し'
const DIALOG_CLOSE_KEY = 'Escape'
const OPEN_KEYS = ['Enter', ' '] as const
const JUDGE_NAMES = ['ひろゆき風', 'デヴィ婦人風', '中尾彬風'] as const
const HIROYUKI_INDEX = 0
const HIROYUKI_CATCHPHRASE = 'それってあなたの感想ですよね'
const ROOT_PATH = '/'
const JUDGING_PATH_PREFIX = '/judging/'
const JUDGING_POLLING_INTERVAL_MS = 3000
const JUDGING_POLLING_TIMEOUT_MS = 60000
const RESULT_MODAL_ERROR_NOT_FOUND = 'NOT_FOUND'
const RESULT_MODAL_ERROR_FETCH_FAILED = 'FETCH_ERROR'

const RANKING_ERROR_MESSAGES = {
  rateLimited: 'アクセスが集中しています。しばらく待ってから再度お試しください。',
  failed: '取得に失敗しました。時間をおいて再度お試しください。',
  network: '通信状況を確認して再度お試しください。',
} as const

type ValidationErrors = {
  nicknameError: string
  bodyError: string
}

type ViewMode = 'top' | 'judging'

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function readJudgingRoutePostId(pathname: string): string | null {
  const matched = pathname.match(/^\/judging\/(.+)$/)
  return matched?.[1] ?? null
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

function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiClientError ? error.status : (error as { status?: number })?.status
}

function resolvePostDetailErrorMessage(error: unknown): string {
  const errorStatus = getErrorStatus(error)

  if (errorStatus === HTTP_STATUS.NOT_FOUND) {
    return MESSAGE_POST_NOT_FOUND
  }
  if (errorStatus === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return MESSAGE_POST_DETAIL_RATE_LIMITED
  }
  if (errorStatus && SERVER_ERROR_STATUSES.includes(errorStatus)) {
    return MESSAGE_POST_DETAIL_SERVER_ERROR
  }

  return MESSAGE_POST_DETAIL_NETWORK_ERROR
}

function resolveResultModalErrorCode(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.code
  }
  if (getErrorStatus(error) === HTTP_STATUS.NOT_FOUND) {
    return RESULT_MODAL_ERROR_NOT_FOUND
  }
  return RESULT_MODAL_ERROR_FETCH_FAILED
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

function RankingSection({
  myPostIds,
  onSelectRankingPost,
}: {
  myPostIds: string[]
  onSelectRankingPost: (postId: string) => void
}) {
  const { data, isLoading, isError, error } = useRankings(DEFAULT_RANKING_LIMIT, {
    polling: true,
  })
  const displayRankings = buildDisplayRankings(data?.rankings)
  const myPostIdSet = new Set(myPostIds)

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
          {displayRankings.map((item) => {
            const isMyPost = myPostIdSet.has(item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="ranking-item"
                  className={`w-full rounded border p-3 text-left ${isMyPost ? 'bg-yellow-100 border-l-4 border-l-red-500' : ''}`}
                  onClick={() => onSelectRankingPost(item.id)}
                  onKeyDown={(event) => {
                    if (OPEN_KEYS.includes(event.key as (typeof OPEN_KEYS)[number])) {
                      event.preventDefault()
                      onSelectRankingPost(item.id)
                    }
                  }}
                >
                  <p className="font-semibold">{item.rank}位 {item.nickname}</p>
                  <p>{item.body}</p>
                  <p className="text-sm text-gray-600">平均スコア: {item.average_score.toFixed(1)}</p>
                  {isMyPost && <p className="text-sm font-bold">あなたの投稿</p>}
                </button>
              </li>
            )
          })}
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
  const [judgingNickname, setJudgingNickname] = useState(MESSAGE_JUDGING_NICKNAME_FALLBACK)
  const [judgingBody, setJudgingBody] = useState(MESSAGE_JUDGING_BODY_FALLBACK)
  const [myPostsError, setMyPostsError] = useState('')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isLoadingPostDetail, setIsLoadingPostDetail] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('top')
  const [judgingPostId, setJudgingPostId] = useState('')
  const [judgingErrorMessage, setJudgingErrorMessage] = useState('')
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [activeResultPostId, setActiveResultPostId] = useState('')
  const [activeResultPost, setActiveResultPost] = useState<Post | null>(null)
  const [isResultPostLoading, setIsResultPostLoading] = useState(false)
  const [resultModalErrorCode, setResultModalErrorCode] = useState<string | null>(null)
  const inFlightPostIdsRef = useRef<Set<string>>(new Set())
  const resultTriggerRef = useRef<HTMLElement | null>(null)
  const resultRequestSeqRef = useRef(0)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingStartedAtRef = useRef<number>(0)
  const pollingAbortControllerRef = useRef<AbortController | null>(null)
  const activeResultErrorCode = resultModalErrorCode
  const syncMyPostIds = () => setMyPostIds(readPostIds())
  const saveResultModalTrigger = useCallback(() => {
    resultTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [])
  const resetResultModalState = useCallback(() => {
    setActiveResultPost(null)
    setIsResultPostLoading(false)
    setResultModalErrorCode(null)
  }, [])
  const syncTopPath = useCallback(() => {
    window.history.replaceState({}, '', ROOT_PATH)
  }, [])
  const syncJudgingPath = useCallback((postId: string) => {
    window.history.pushState({}, '', `${JUDGING_PATH_PREFIX}${postId}`)
  }, [])
  const fetchResultPost = useCallback(async (postId: string, force: boolean = false) => {
    // 連続選択時は requestSeq をインクリメントし、最後の要求のみ反映する。
    const requestSeq = ++resultRequestSeqRef.current
    setIsResultPostLoading(true)
    setResultModalErrorCode(null)

    if (!force) {
      // 同一ID再表示ではキャッシュを優先し、不要な再取得を避ける。
      const cachedPost = queryClient.getQueryData<Post>(queryKeys.posts.detail(postId))
      if (cachedPost) {
        if (requestSeq === resultRequestSeqRef.current) {
          setActiveResultPost(cachedPost)
          setIsResultPostLoading(false)
        }
        return
      }
    }

    try {
      const response = await api.posts.get(postId)
      if (requestSeq !== resultRequestSeqRef.current) return
      queryClient.setQueryData(queryKeys.posts.detail(postId), response)
      setActiveResultPost(response)
      setResultModalErrorCode(null)
    } catch (error) {
      if (requestSeq !== resultRequestSeqRef.current) return
      setActiveResultPost(null)
      setResultModalErrorCode(resolveResultModalErrorCode(error))
    } finally {
      if (requestSeq === resultRequestSeqRef.current) {
        setIsResultPostLoading(false)
      }
    }
  }, [])

  const openResultModal = useCallback((postId: string, initialPost?: Post | null) => {
    saveResultModalTrigger()
    setActiveResultPostId(postId)
    setResultModalErrorCode(null)
    if (initialPost) {
      queryClient.setQueryData(queryKeys.posts.detail(postId), initialPost)
      setActiveResultPost(initialPost)
      setIsResultPostLoading(false)
    } else {
      setActiveResultPost(null)
      void fetchResultPost(postId)
    }
    setIsResultModalOpen(true)
    setViewMode('top')
  }, [fetchResultPost, saveResultModalTrigger])

  const openResultModalWithError = useCallback((postId: string, errorCode: string) => {
    saveResultModalTrigger()
    setActiveResultPostId(postId)
    setActiveResultPost(null)
    setResultModalErrorCode(errorCode)
    setIsResultPostLoading(false)
    setIsResultModalOpen(true)
    setViewMode('top')
  }, [saveResultModalTrigger])

  const closeResultModal = useCallback(() => {
    setIsResultModalOpen(false)
    resetResultModalState()
    resultRequestSeqRef.current += 1
    requestAnimationFrame(() => {
      if (resultTriggerRef.current && document.body.contains(resultTriggerRef.current)) {
        resultTriggerRef.current.focus()
      }
    })
  }, [resetResultModalState])

  const retryResultModal = useCallback(() => {
    if (!activeResultPostId) return
    void fetchResultPost(activeResultPostId, true)
  }, [activeResultPostId, fetchResultPost])

  useEffect(() => {
    if (!isResultModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isResultModalOpen])

  const clearJudgingPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    if (pollingAbortControllerRef.current) {
      pollingAbortControllerRef.current.abort()
      pollingAbortControllerRef.current = null
    }
    pollingStartedAtRef.current = 0
  }, [])

  const enterJudgingMode = useCallback((postId: string, nickname?: string) => {
    setJudgingPostId(postId)
    setJudgingNickname(nickname || MESSAGE_JUDGING_NICKNAME_FALLBACK)
    setJudgingBody(MESSAGE_JUDGING_BODY_FALLBACK)
    setJudgingErrorMessage('')
    setViewMode('judging')
  }, [])

  const exitJudgingWithResult = useCallback((post: Post) => {
    clearJudgingPolling()
    syncTopPath()
    openResultModal(post.id, post)
  }, [clearJudgingPolling, openResultModal, syncTopPath])

  const exitJudgingWithError = useCallback(() => {
    clearJudgingPolling()
    setViewMode('top')
    setSuccessMessage('')
    setJudgingErrorMessage(MESSAGE_JUDGING_FETCH_FAILED)
    syncTopPath()
  }, [clearJudgingPolling, syncTopPath])
  const exitJudgingWithResultRef = useRef(exitJudgingWithResult)
  const exitJudgingWithErrorRef = useRef(exitJudgingWithError)

  useEffect(() => {
    exitJudgingWithResultRef.current = exitJudgingWithResult
  }, [exitJudgingWithResult])

  useEffect(() => {
    exitJudgingWithErrorRef.current = exitJudgingWithError
  }, [exitJudgingWithError])

  useEffect(() => {
    const routePostId = readJudgingRoutePostId(window.location.pathname)
    if (!routePostId) return
    if (!isUuidLike(routePostId)) {
      setJudgingErrorMessage(MESSAGE_JUDGING_FETCH_FAILED)
      setViewMode('top')
      syncTopPath()
      return
    }

    enterJudgingMode(routePostId)
  }, [enterJudgingMode, syncTopPath])

  useEffect(() => {
    if (viewMode !== 'judging' || !judgingPostId) return

    let isDisposed = false

    const handleJudgingFetchFailed = () => {
      if (isDisposed) return
      exitJudgingWithErrorRef.current()
    }

    const fetchPost = async () => {
      const elapsed = Date.now() - pollingStartedAtRef.current
      // 監視上限60秒を超えた場合はAPIを呼ばずに終端する。
      if (elapsed >= JUDGING_POLLING_TIMEOUT_MS) {
        handleJudgingFetchFailed()
        return
      }

      try {
        pollingAbortControllerRef.current?.abort()
        const abortController = new AbortController()
        pollingAbortControllerRef.current = abortController

        const response = await api.posts.get(judgingPostId, {
          signal: abortController.signal,
        })
        if (isDisposed) return
        if (response.status === 'scored' || response.status === 'failed') {
          exitJudgingWithResultRef.current(response)
          return
        }
        setJudgingNickname(response.nickname || MESSAGE_JUDGING_NICKNAME_FALLBACK)
        setJudgingBody(response.body || MESSAGE_JUDGING_BODY_FALLBACK)
      } catch (error) {
        if (isDisposed) return
        if (error instanceof ApiClientError && error.code === API_ERROR_CODE.ABORTED) return
        // 404は対象投稿が消失しているため即時終了とする。
        if (getErrorStatus(error) === HTTP_STATUS.NOT_FOUND) {
          handleJudgingFetchFailed()
          return
        }

        const retryElapsed = Date.now() - pollingStartedAtRef.current
        // 500系/通信系は60秒枠内で再試行し、超過時のみ終了する。
        if (retryElapsed >= JUDGING_POLLING_TIMEOUT_MS) {
          handleJudgingFetchFailed()
        }
      }
    }

    clearJudgingPolling()
    pollingStartedAtRef.current = Date.now()
    void fetchPost()
    pollingTimerRef.current = setInterval(() => {
      void fetchPost()
    }, JUDGING_POLLING_INTERVAL_MS)

    return () => {
      isDisposed = true
      clearJudgingPolling()
    }
  }, [viewMode, judgingPostId, clearJudgingPolling])

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
    setJudgingErrorMessage('')

    if (nextNicknameError || nextBodyError) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await api.posts.create({ nickname: trimmedNickname, body: trimmedBody })
      savePostId(response.id)
      syncMyPostIds()
      setNickname('')
      setBody('')
      setSuccessMessage(MESSAGE_SUCCESS)
      enterJudgingMode(response.id, trimmedNickname)
      syncJudgingPath(response.id)
    } catch (error) {
      setSubmitError(resolveSubmitErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openMyPosts = () => {
    syncMyPostIds()
    setIsMyPostsOpen(true)
  }

  const closeMyPosts = () => {
    setIsMyPostsOpen(false)
    setSelectedPost(null)
    setIsLoadingPostDetail(false)
  }

  const handleMyPostsTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (OPEN_KEYS.includes(event.key as (typeof OPEN_KEYS)[number])) {
      event.preventDefault()
      openMyPosts()
    }
  }

  const handleRankingPostClick = (postId: string) => {
    openResultModal(postId)
  }

  const handleMyPostClick = async (postId: string) => {
    if (inFlightPostIdsRef.current.has(postId)) {
      return
    }

    inFlightPostIdsRef.current.add(postId)
    setIsLoadingPostDetail(true)
    setMyPostsError('')
    const previousPostIds = readPostIds()

    // 404ケースの即時反映を維持するため、クリック時点で対象IDを一旦除外する。
    // 404以外の結果では直前状態を復元し、既存仕様の振る舞いを維持する。
    removePostId(postId)
    syncMyPostIds()
    try {
      const response = await api.posts.get(postId)
      setSelectedPost(response)
      if (response.status === 'scored' || response.status === 'failed') {
        openResultModal(postId, response)
      }
      writePostIds(previousPostIds)
      syncMyPostIds()
    } catch (error) {
      const message = resolvePostDetailErrorMessage(error)
      setMyPostsError(message)
      openResultModalWithError(postId, resolveResultModalErrorCode(error))
      if (getErrorStatus(error) !== HTTP_STATUS.NOT_FOUND) {
        writePostIds(previousPostIds)
        syncMyPostIds()
      }
    } finally {
      setIsLoadingPostDetail(false)
      inFlightPostIdsRef.current.delete(postId)
    }
  }

  const displayMyPostIds = Array.from(new Set(myPostIds)).slice(0, MAX_STORED_POST_IDS)
  const isResultModalLoading = isResultPostLoading && !activeResultPost

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-6">
        <header role="banner" className="mb-4">
          <h1 className="text-2xl font-bold">あるあるアリーナ</h1>
        </header>

        {viewMode === 'judging' && (
          <section
            data-testid="judging-screen"
            aria-label="審査中"
            aria-live="polite"
            className="mb-4 rounded border p-4"
          >
            <h2 className="mb-2 text-lg font-semibold">審査中</h2>
            <p className="mb-2">{judgingNickname}</p>
            <p className="mb-4">{judgingBody}</p>
            <ul className="mb-4 space-y-1">
              {JUDGE_NAMES.map((judgeName, index) => (
                <li key={judgeName}>
                  <p>{judgeName}</p>
                  {index === HIROYUKI_INDEX && (
                    <p data-testid="catchphrase-hiroyuki">{HIROYUKI_CATCHPHRASE}</p>
                  )}
                </li>
              ))}
            </ul>
            <p>{MESSAGE_JUDGING_LOADING}</p>
          </section>
        )}

        {viewMode === 'top' && (
          <>
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
              {judgingErrorMessage && <p>{judgingErrorMessage}</p>}
            </form>

            <RankingSection myPostIds={myPostIds} onSelectRankingPost={handleRankingPostClick} />

            <footer role="contentinfo">
              <button type="button" onClick={openMyPosts} onKeyDown={handleMyPostsTriggerKeyDown}>
                自分の投稿一覧
              </button>
              <p>フッター</p>
            </footer>
          </>
        )}

        {viewMode === 'top' && isMyPostsOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="自分の投稿"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onKeyDown={(event) => {
              if (event.key === DIALOG_CLOSE_KEY) closeMyPosts()
            }}
          >
            <div className="w-full max-w-md rounded bg-white p-4">
              {selectedPost ? (
                <MyPostDetail
                  post={selectedPost}
                  onBack={() => setSelectedPost(null)}
                  onClose={closeMyPosts}
                />
              ) : (
                <>
                  <h2 className="mb-3 text-lg font-semibold">自分の投稿</h2>
                  {myPostsError && <p className="mb-3">{myPostsError}</p>}
                  {isLoadingPostDetail && <p className="mb-3">投稿詳細を読み込み中です...</p>}
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
                </>
              )}
            </div>
          </div>
        )}

        <ResultModal
          isOpen={isResultModalOpen}
          post={activeResultPost}
          isLoading={isResultModalLoading}
          errorCode={activeResultErrorCode}
          onRetry={retryResultModal}
          onClose={closeResultModal}
        />
      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
