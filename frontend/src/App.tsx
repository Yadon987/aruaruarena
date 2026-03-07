import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NeonButton } from './components/ui/NeonButton'
import { JudgeAvatars } from './features/judging/components/JudgeAvatars'
import { RankingModal } from './features/ranking'
import { ResultModal } from './features/result'
import { MyPostDetail } from './features/top/components/MyPostDetail'
import { PostFormModal } from './features/top/components/PostFormModal'
import { PrivacyPolicyModal } from './features/top/components/PrivacyPolicyModal'
import { SoundToggleButton } from './features/top/components/SoundToggleButton'
import { createSoundController } from './hooks/useSound'
import { queryClient } from './shared/config/queryClient'
import { API_ERROR_CODE, HTTP_STATUS } from './shared/constants/api'
import { queryKeys } from './shared/constants/queryKeys'
import { useAvatarImages } from './shared/hooks/useAvatarImages'
import { ApiClientError, api } from './shared/services/api'
import type { CreatePostResponse } from './shared/types/api'
import type { Post } from './shared/types/domain'
import './App.css'

const STORAGE_KEY = 'my_post_ids'
const LEGACY_STORAGE_KEY = 'aruaruarena_my_posts'
const MIN_BODY_LENGTH = 3
const MAX_STORED_POST_IDS = 20
const SERVER_ERROR_STATUSES: ReadonlyArray<number> = [
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
]
const MESSAGE_NICKNAME_REQUIRED = 'ニックネームを入力してください'
const MESSAGE_BODY_REQUIRED = '本文は3文字以上で入力してください'
const MESSAGE_SUCCESS = '投稿を受け付けました'
const MESSAGE_POST_NOT_FOUND = '投稿が見つかりませんでした'
const MESSAGE_MY_POST_DETAIL_FETCH_FAILED = '投稿詳細の取得に失敗しました'
const MESSAGE_POST_DETAIL_RATE_LIMITED = 'アクセスが集中しています。時間をおいて再度お試しください'
const MESSAGE_POST_DETAIL_SERVER_ERROR = '一時的なエラーです。時間をおいて再試行してください'
const MESSAGE_POST_DETAIL_NETWORK_ERROR = 'ネットワーク接続を確認してください'
const MESSAGE_JUDGING_FETCH_FAILED =
  '投稿情報の取得に失敗しました。トップへ戻って再度お試しください。'
const MESSAGE_JUDGING_NETWORK_ERROR = 'ネットワークに接続できませんでした'
const MESSAGE_JUDGING_TIMEOUT_ERROR = '通信がタイムアウトしました'
const MESSAGE_JUDGING_SERVER_ERROR = 'サーバーエラーが発生しました'
const MESSAGE_JUDGING_CLIENT_ERROR = '投稿に失敗しました'
const MESSAGE_JUDGING_UNKNOWN_ERROR = '投稿に失敗しました'
const MESSAGE_JUDGING_LOADING = 'AI審査員が採点中...'
const MESSAGE_JUDGING_BODY_FALLBACK = '投稿内容を読み込み中です'
const MESSAGE_JUDGING_NICKNAME_FALLBACK = '名無し'
const MESSAGE_INVALID_FORM_ERROR = 'ニックネームと本文を正しく入力してください。'
const DIALOG_CLOSE_KEY = 'Escape'
const OPEN_KEYS = ['Enter', ' '] as const
const ROOT_PATH = '/'
const JUDGING_PATH_PREFIX = '/judging/'
const JUDGING_PATH_PATTERN = /^\/judging\/(.+)$/
const JUDGING_POLLING_INTERVAL_MS = 3000
const JUDGING_POLLING_TIMEOUT_MS = 60000
const RESULT_MODAL_ERROR_NOT_FOUND = 'NOT_FOUND'
const RESULT_MODAL_ERROR_FETCH_FAILED = 'FETCH_ERROR'
const MAX_MY_POST_PREFETCH_CONCURRENCY = 3
const SOUND_SE_SUBMIT = 'se_submit'
const SOUND_SE_RETRY = 'se_retry'
const SOUND_SE_RESULT_OPEN = 'se_result_open'
const FIXED_FOOTER_MIN_RESERVED_PX = 96
const FIXED_FOOTER_EXTRA_GAP_PX = 12

type ValidationErrors = {
  nicknameError: string
  bodyError: string
}

type ViewMode = 'top' | 'judging'

function canOpenResultModalFromMyPost(post: Post): boolean {
  return (
    (post.status === 'scored' || post.status === 'failed') && typeof post.total_count === 'number'
  )
}

function shouldOpenResultModalOnMyPostError(status: number | undefined): boolean {
  return Boolean(status && SERVER_ERROR_STATUSES.includes(status))
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function readJudgingRoutePostId(pathname: string): string | null {
  const matched = pathname.match(JUDGING_PATH_PATTERN)
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
  if (getErrorStatus(error) === HTTP_STATUS.NOT_FOUND) {
    return RESULT_MODAL_ERROR_NOT_FOUND
  }
  if (error instanceof ApiClientError) {
    return error.code
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
function resolveJudgingSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === API_ERROR_CODE.NETWORK_ERROR) {
      return MESSAGE_JUDGING_NETWORK_ERROR
    }
    if (error.code === API_ERROR_CODE.TIMEOUT || error.status === HTTP_STATUS.REQUEST_TIMEOUT) {
      return MESSAGE_JUDGING_TIMEOUT_ERROR
    }
    if (SERVER_ERROR_STATUSES.includes(error.status)) {
      return MESSAGE_JUDGING_SERVER_ERROR
    }
    if (
      error.status >= HTTP_STATUS.BAD_REQUEST &&
      error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
    ) {
      return MESSAGE_JUDGING_CLIENT_ERROR
    }
  }

  return MESSAGE_JUDGING_UNKNOWN_ERROR
}

function App() {
  const soundControllerRef = useRef<ReturnType<typeof createSoundController> | null>(null)
  useAvatarImages()
  if (!soundControllerRef.current) {
    soundControllerRef.current = createSoundController()
  }
  const sound = soundControllerRef.current
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [myPostIds, setMyPostIds] = useState<string[]>(() => readPostIds())
  const [isMyPostsOpen, setIsMyPostsOpen] = useState(false)
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false)
  const [judgingNickname, setJudgingNickname] = useState(MESSAGE_JUDGING_NICKNAME_FALLBACK)
  const [judgingBody, setJudgingBody] = useState(MESSAGE_JUDGING_BODY_FALLBACK)
  const [myPostsError, setMyPostsError] = useState('')
  const [myPostDetails, setMyPostDetails] = useState<Record<string, Post>>({})
  const [myPostDetailErrors, setMyPostDetailErrors] = useState<Record<string, string>>({})
  const [loadingMyPostIds, setLoadingMyPostIds] = useState<string[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isLoadingPostDetail, setIsLoadingPostDetail] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('top')
  const [isMuted, setIsMuted] = useState(() => sound.isMuted)
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [judgingPostId, setJudgingPostId] = useState('')
  const [judgingErrorMessage, setJudgingErrorMessage] = useState('')
  const [pendingFormData, setPendingFormData] = useState<{ nickname: string; body: string } | null>(
    null
  )
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [activeResultPostId, setActiveResultPostId] = useState('')
  const [activeResultPost, setActiveResultPost] = useState<Post | null>(null)
  const [isResultPostLoading, setIsResultPostLoading] = useState(false)
  const [resultModalErrorCode, setResultModalErrorCode] = useState<string | null>(null)
  const [isJudgingPollingReady, setIsJudgingPollingReady] = useState(false)
  const [footerReservedSpace, setFooterReservedSpace] = useState(FIXED_FOOTER_MIN_RESERVED_PX)
  const inFlightPostIdsRef = useRef<Set<string>>(new Set())
  const myPostDetailsRef = useRef<Record<string, Post>>({})
  const myPostsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const privacyPolicyTriggerRef = useRef<HTMLButtonElement | null>(null)
  const rankingTriggerRef = useRef<HTMLButtonElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)
  const resultTriggerRef = useRef<HTMLElement | null>(null)
  const resultRequestSeqRef = useRef(0)
  const previousResultModalOpenRef = useRef(false)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingStartedAtRef = useRef<number>(0)
  const pollingAbortControllerRef = useRef<AbortController | null>(null)
  const activeResultErrorCode = resultModalErrorCode
  const resultAudioScene = useMemo(() => {
    if (!isResultModalOpen || !activeResultPost) return null
    return activeResultPost.status === 'scored' ? 'success' : 'failed'
  }, [activeResultPost, isResultModalOpen])
  const audioScene = resultAudioScene ?? viewMode
  const syncMyPostIds = useCallback(() => setMyPostIds(readPostIds()), [])
  const setMyPostLoading = useCallback((postId: string, isLoading: boolean) => {
    setLoadingMyPostIds((prev) => {
      if (isLoading) {
        if (prev.includes(postId)) return prev
        return [...prev, postId]
      }
      return prev.filter((id) => id !== postId)
    })
  }, [])
  const clearMyPostDetailError = useCallback((postId: string) => {
    setMyPostDetailErrors((prev) => {
      if (!prev[postId]) return prev
      const next = { ...prev }
      delete next[postId]
      return next
    })
  }, [])
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

  const openResultModal = useCallback(
    (postId: string, initialPost?: Post | null) => {
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
    },
    [fetchResultPost, saveResultModalTrigger]
  )

  const openResultModalWithError = useCallback(
    (postId: string, errorCode: string) => {
      saveResultModalTrigger()
      setActiveResultPostId(postId)
      setActiveResultPost(null)
      setResultModalErrorCode(errorCode)
      setIsResultPostLoading(false)
      setIsResultModalOpen(true)
      setViewMode('top')
    },
    [saveResultModalTrigger]
  )

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
  const handlePlayRetrySound = useCallback(() => {
    sound.playSe(SOUND_SE_RETRY)
  }, [sound])

  const handleSoundToggle = useCallback(() => {
    sound.unlockAudio()
    const nextMuted = !isMuted
    sound.setMuted(nextMuted)
    setIsMuted(nextMuted)
    if (!nextMuted) {
      sound.playSceneBgm(audioScene)
    }
  }, [audioScene, isMuted, sound])

  useEffect(() => {
    if (sound.audioUnlocked) return

    const handleUnlock = () => {
      sound.unlockAudio()
      if (!sound.isMuted) {
        sound.playSceneBgm(audioScene)
      }
      document.removeEventListener('pointerdown', handleUnlock)
      document.removeEventListener('touchend', handleUnlock)
      document.removeEventListener('keydown', handleUnlock)
    }

    document.addEventListener('pointerdown', handleUnlock, { once: true })
    document.addEventListener('touchend', handleUnlock, { once: true })
    document.addEventListener('keydown', handleUnlock, { once: true })

    return () => {
      document.removeEventListener('pointerdown', handleUnlock)
      document.removeEventListener('touchend', handleUnlock)
      document.removeEventListener('keydown', handleUnlock)
    }
  }, [audioScene, sound])

  useEffect(() => {
    sound.playSceneBgm(audioScene)
  }, [audioScene, sound])

  useEffect(() => {
    if (!previousResultModalOpenRef.current && isResultModalOpen) {
      sound.playSe(SOUND_SE_RESULT_OPEN)
    }
    previousResultModalOpenRef.current = isResultModalOpen
  }, [isResultModalOpen, sound])

  useEffect(() => {
    if (!isResultModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isResultModalOpen])

  useEffect(() => {
    if (!isPrivacyPolicyOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      // モーダル解除時に body の状態を復元しないと、画面全体がスクロール不能のまま残る。
      document.body.style.overflow = previousOverflow
    }
  }, [isPrivacyPolicyOpen])

  useEffect(() => {
    if (!isRankingModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isRankingModalOpen])

  useEffect(() => {
    return () => {
      sound.dispose()
    }
  }, [sound])

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

  const enterJudgingMode = useCallback(
    (postId: string, nickname?: string, body?: string, isPollingReady: boolean = true) => {
      setJudgingPostId(postId)
      setJudgingNickname(nickname || MESSAGE_JUDGING_NICKNAME_FALLBACK)
      setJudgingBody(body || MESSAGE_JUDGING_BODY_FALLBACK)
      setJudgingErrorMessage('')
      setViewMode('judging')
      setIsJudgingPollingReady(isPollingReady)
    },
    []
  )

  const startJudgingSubmission = useCallback(
    (temporaryPostId: string, nickname: string, body: string) => {
      // API確定前に審査中画面へ先に遷移し、体感速度を落とさずフィードバックする。
      setPendingFormData({ nickname, body })
      sound.playSe(SOUND_SE_SUBMIT)
      setIsPostModalOpen(false)
      enterJudgingMode(temporaryPostId, nickname, body, false)
      syncJudgingPath(temporaryPostId)
    },
    [enterJudgingMode, sound, syncJudgingPath]
  )

  const applyJudgingSubmitSuccess = useCallback(
    (response: CreatePostResponse, optimisticNickname: string, optimisticBody: string) => {
      // 正式IDへ差し替えた後、レスポンス状態に応じて画面遷移を確定する。
      setPendingFormData(null)
      savePostId(response.id)
      syncMyPostIds()
      setJudgingPostId(response.id)
      syncJudgingPath(response.id)
      setIsJudgingPollingReady(true)

      if (response.status === 'failed') {
        // failed応答は結果モーダルへ直接遷移し、ポーリングは中断する。
        setSuccessMessage('')
        setJudgingErrorMessage('')
        openResultModal(response.id)
        setIsJudgingPollingReady(false)
        return
      }

      // 審査中/queued など成功側は、暫定情報を残して審査待ちへ進める。
      setSuccessMessage(MESSAGE_SUCCESS)
      enterJudgingMode(response.id, optimisticNickname, optimisticBody, true)
    },
    [openResultModal, savePostId, syncJudgingPath, syncMyPostIds, enterJudgingMode]
  )

  const applyJudgingSubmitFailure = useCallback((error: unknown) => {
    // API失敗時は入力値を保持したまま、再投稿導線へ戻す。
    console.error('Post creation failed:', error)
    setJudgingErrorMessage(resolveJudgingSubmitErrorMessage(error))
    setIsJudgingPollingReady(false)
    setSuccessMessage('')
  }, [])

  const handleResultRejudgeSuccess = useCallback(
    (post: Post) => {
      // 再審査開始がAPIで確定した場合のみ、審査中画面へ遷移する。
      closeResultModal()
      enterJudgingMode(post.id, post.nickname)
      syncJudgingPath(post.id)
    },
    [closeResultModal, enterJudgingMode, syncJudgingPath]
  )

  const exitJudgingWithResult = useCallback(
    (post: Post) => {
      clearJudgingPolling()
      setIsJudgingPollingReady(false)
      syncTopPath()
      openResultModal(post.id, post)
    },
    [clearJudgingPolling, openResultModal, syncTopPath]
  )

  const exitJudgingWithError = useCallback(() => {
    clearJudgingPolling()
    setViewMode('top')
    setIsJudgingPollingReady(false)
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
    if (viewMode !== 'judging' || !judgingPostId || !isJudgingPollingReady) return

    let isDisposed = false

    const handleJudgingFetchFailed = () => {
      if (isDisposed) return
      exitJudgingWithErrorRef.current()
    }

    const fetchPost = async () => {
      const elapsed = Date.now() - pollingStartedAtRef.current
      // 監視上限（JUDGING_POLLING_TIMEOUT_MS。現在は60秒）を超えた場合はAPIを呼ばずに終端する。
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
        // 500系/通信系は監視上限（JUDGING_POLLING_TIMEOUT_MS。現在は60秒）内で再試行し、超過時のみ終了する。
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
  }, [viewMode, judgingPostId, isJudgingPollingReady, clearJudgingPolling])

  const onSubmit = useCallback(
    async ({ nickname, body }: { nickname: string; body: string }) => {
      if (isSubmitting) return

      const trimmedNickname = nickname.trim()
      const trimmedBody = body.trim()
      const { nicknameError: nextNicknameError, bodyError: nextBodyError } = validateForm(
        trimmedNickname,
        trimmedBody
      )

      setSubmitError('')
      setSuccessMessage('')
      setJudgingErrorMessage('')

      if (nextNicknameError || nextBodyError) {
        setSubmitError(MESSAGE_INVALID_FORM_ERROR)
        setPendingFormData(null)
        return
      }

      // 楽観的UI: API待機中にフォームを閉じ、審査中画面へ先行遷移する。
      setIsSubmitting(true)
      const temporaryPostId = crypto.randomUUID()
      startJudgingSubmission(temporaryPostId, trimmedNickname, trimmedBody)
      try {
        const response = await api.posts.create({
          nickname: trimmedNickname,
          body: trimmedBody,
        })
        applyJudgingSubmitSuccess(response, trimmedNickname, trimmedBody)
      } catch (error) {
        applyJudgingSubmitFailure(error)
      } finally {
        setIsSubmitting(false)
      }
    },
    [applyJudgingSubmitFailure, applyJudgingSubmitSuccess, isSubmitting, startJudgingSubmission]
  )

  const storeMyPostDetail = useCallback((postId: string, post: Post) => {
    setMyPostDetails((prev) => {
      const next = { ...prev, [postId]: post }
      myPostDetailsRef.current = next
      return next
    })
  }, [])

  const restorePostIdsAfterNonNotFound = useCallback(
    (previousPostIds: string[]) => {
      writePostIds(previousPostIds)
      syncMyPostIds()
    },
    [syncMyPostIds]
  )

  const fetchMyPostDetailForList = useCallback(
    async (postId: string, force: boolean = false) => {
      if (!force && myPostDetailsRef.current[postId]) return myPostDetailsRef.current[postId]
      if (inFlightPostIdsRef.current.has(postId)) return null

      // 一覧行とクリック遷移の二重リクエストを防ぐため、ID単位でin-flightを共有管理する。
      inFlightPostIdsRef.current.add(postId)
      setMyPostLoading(postId, true)
      try {
        const response = await api.posts.get(postId)
        storeMyPostDetail(postId, response)
        clearMyPostDetailError(postId)
        return response
      } catch (error) {
        if (getErrorStatus(error) !== HTTP_STATUS.NOT_FOUND) {
          setMyPostDetailErrors((prev) => ({
            ...prev,
            [postId]: MESSAGE_MY_POST_DETAIL_FETCH_FAILED,
          }))
        }
        return null
      } finally {
        setMyPostLoading(postId, false)
        inFlightPostIdsRef.current.delete(postId)
      }
    },
    [clearMyPostDetailError, setMyPostLoading, storeMyPostDetail]
  )

  const prefetchMyPostsDetails = useCallback(
    async (postIds: string[]) => {
      const queue = [...postIds]
      const workers = Array.from(
        { length: Math.min(MAX_MY_POST_PREFETCH_CONCURRENCY, queue.length) },
        async () => {
          while (queue.length > 0) {
            const postId = queue.shift()
            if (!postId) return
            await fetchMyPostDetailForList(postId)
          }
        }
      )
      await Promise.all(workers)
    },
    [fetchMyPostDetailForList]
  )

  const resetMyPostsModalState = useCallback(() => {
    setSelectedPost(null)
    setIsLoadingPostDetail(false)
  }, [])

  const openMyPosts = () => {
    syncMyPostIds()
    setMyPostsError('')
    setIsPrivacyPolicyOpen(false)
    setIsRankingModalOpen(false)
    setIsMyPostsOpen(true)
    resetMyPostsModalState()
  }

  const closeMyPosts = (restoreFocus: boolean = true) => {
    setIsMyPostsOpen(false)
    resetMyPostsModalState()
    if (restoreFocus) {
      // 明示クローズ時のみトリガーへ復帰し、結果モーダル遷移時はフォーカスを奪わない。
      myPostsTriggerRef.current?.focus()
    }
  }

  const handleMyPostsTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (OPEN_KEYS.includes(event.key as (typeof OPEN_KEYS)[number])) {
      event.preventDefault()
      openMyPosts()
    }
  }

  const openPrivacyPolicy = () => {
    setIsMyPostsOpen(false)
    setIsRankingModalOpen(false)
    resetMyPostsModalState()
    setIsPrivacyPolicyOpen(true)
  }

  const closePrivacyPolicy = () => {
    setIsPrivacyPolicyOpen(false)
  }

  const openRankingModal = () => {
    setIsMyPostsOpen(false)
    setIsPrivacyPolicyOpen(false)
    resetMyPostsModalState()
    setIsRankingModalOpen(true)
  }

  const closeRankingModal = () => {
    setIsRankingModalOpen(false)
  }

  const retryPostSubmit = useCallback(() => {
    // 再投稿は入力復元を前提に、トップの投稿モーダルへ復帰するだけの導線に限定する。
    clearJudgingPolling()
    setSuccessMessage('')
    setSubmitError('')
    setViewMode('top')
    setIsPostModalOpen(true)
    syncTopPath()
  }, [clearJudgingPolling, syncTopPath])

  const handleRankingPostClick = (postId: string) => {
    openResultModal(postId)
  }

  const handleMyPostClick = async (postId: string) => {
    const cachedPost = myPostDetails[postId]
    if (cachedPost) {
      if (canOpenResultModalFromMyPost(cachedPost)) {
        closeMyPosts(false)
        openResultModal(postId, cachedPost)
      } else {
        setSelectedPost(cachedPost)
      }
      return
    }

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
      storeMyPostDetail(postId, response)
      clearMyPostDetailError(postId)
      if (canOpenResultModalFromMyPost(response)) {
        closeMyPosts(false)
        openResultModal(postId, response)
      } else {
        setSelectedPost(response)
      }
      restorePostIdsAfterNonNotFound(previousPostIds)
    } catch (error) {
      const status = getErrorStatus(error)
      // 404は欠損投稿として一覧モーダル内で通知し、非404は復旧導線を維持する。
      setMyPostsError(resolvePostDetailErrorMessage(error))
      if (status === HTTP_STATUS.NOT_FOUND) {
        closeMyPosts(false)
        openResultModalWithError(postId, resolveResultModalErrorCode(error))
      } else {
        setMyPostDetailErrors((prev) => ({
          ...prev,
          [postId]: MESSAGE_MY_POST_DETAIL_FETCH_FAILED,
        }))
        if (shouldOpenResultModalOnMyPostError(status)) {
          closeMyPosts(false)
          openResultModalWithError(postId, resolveResultModalErrorCode(error))
        }
        restorePostIdsAfterNonNotFound(previousPostIds)
      }
    } finally {
      setIsLoadingPostDetail(false)
      inFlightPostIdsRef.current.delete(postId)
    }
  }

  const displayMyPostIds = useMemo(
    () => Array.from(new Set(myPostIds)).slice(0, MAX_STORED_POST_IDS),
    [myPostIds]
  )
  const prefetchTargetPostIds = useMemo(
    () => displayMyPostIds.filter((postId) => isUuidLike(postId)),
    [displayMyPostIds]
  )
  const retryMyPostDetail = (postId: string) => {
    void fetchMyPostDetailForList(postId, true)
  }
  const isResultModalLoading = isResultPostLoading && !activeResultPost
  const judgingPhase: 'entrance' | 'speaking' | 'scoring' | 'complete' =
    viewMode === 'judging'
      ? 'speaking'
      : activeResultPost?.status === 'scored'
        ? 'scoring'
        : 'complete'

  useEffect(() => {
    if (!isMyPostsOpen) return
    void prefetchMyPostsDetails(prefetchTargetPostIds)
  }, [isMyPostsOpen, prefetchMyPostsDetails, prefetchTargetPostIds])

  useEffect(() => {
    if (viewMode !== 'top') {
      setFooterReservedSpace(FIXED_FOOTER_MIN_RESERVED_PX)
      return
    }

    const footerElement = footerRef.current
    if (!footerElement) return

    const updateFooterReservedSpace = () => {
      const footerHeight = Math.ceil(footerElement.getBoundingClientRect().height)
      const bottomOffset = Math.ceil(parseFloat(getComputedStyle(footerElement).bottom) || 0)
      const nextReservedSpace = Math.max(
        FIXED_FOOTER_MIN_RESERVED_PX,
        footerHeight + bottomOffset + FIXED_FOOTER_EXTRA_GAP_PX
      )
      setFooterReservedSpace((current) =>
        current === nextReservedSpace ? current : nextReservedSpace
      )
    }

    updateFooterReservedSpace()
    window.addEventListener('resize', updateFooterReservedSpace)

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', updateFooterReservedSpace)
    }

    const observer = new ResizeObserver(updateFooterReservedSpace)
    observer.observe(footerElement)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateFooterReservedSpace)
    }
  }, [viewMode])

  return (
    <QueryClientProvider client={queryClient}>
      <div
        data-testid="top-action-controls"
        className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6 sm:top-6"
      >
        {viewMode === 'top' && (
          <NeonButton
            ariaLabel="投稿する"
            onClick={() => {
              setPendingFormData(null)
              setSubmitError('')
              setIsPostModalOpen(true)
            }}
          >
            投稿する
          </NeonButton>
        )}
        <SoundToggleButton
          isMuted={isMuted}
          onToggle={handleSoundToggle}
          className="neon-button-base neon-glow-pink"
        />
      </div>
      <div
        className="game-show-stage relative min-h-screen overflow-hidden p-6"
        style={{ isolation: 'isolate', paddingBottom: `${footerReservedSpace}px` }}
      >
        <div className="mb-4">
          <JudgeAvatars
            isJudging={viewMode === 'judging'}
            isPostModalOpen={isPostModalOpen}
            judgments={activeResultPost?.judgments}
            judgingPhase={judgingPhase}
          />
        </div>

        {viewMode === 'judging' && (
          <section
            data-testid="judging-screen"
            aria-label="審査中"
            aria-live="polite"
            className="glass-panel relative z-10 mb-4 rounded p-4"
          >
            <h2 className="mb-2 text-lg font-semibold">審査中</h2>
            <p className="mb-2">{judgingNickname}</p>
            <p className="mb-4">{judgingBody}</p>
            <p>{MESSAGE_JUDGING_LOADING}</p>
            {judgingErrorMessage && (
              <div className="mt-2 space-y-2">
                <p className="text-red-500">{judgingErrorMessage}</p>
                <NeonButton ariaLabel="再投稿する" onClick={retryPostSubmit}>
                  再投稿する
                </NeonButton>
              </div>
            )}
          </section>
        )}

        {viewMode === 'top' && (
          <>
            <PostFormModal
              isOpen={isPostModalOpen}
              onClose={() => setIsPostModalOpen(false)}
              onSubmit={onSubmit}
              isLoading={isSubmitting}
              error={submitError}
              initialNickname={pendingFormData?.nickname ?? ''}
              initialBody={pendingFormData?.body ?? ''}
            />
            <div className="mb-4">
              {successMessage && <p className="text-green-500">{successMessage}</p>}
            </div>

            <div className="glass-panel relative z-10 rounded p-2">
              <p className="text-sm text-cyan-100">
                ランキングは「ランキング」ボタンから確認できます
              </p>
            </div>

            <footer
              ref={footerRef}
              role="contentinfo"
              className="fixed bottom-6 inset-x-0 w-full flex flex-wrap items-center justify-center gap-3 z-40 pointer-events-none"
            >
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
                <NeonButton
                  ref={myPostsTriggerRef}
                  type="button"
                  variant="primary"
                  ariaLabel="自分の投稿一覧"
                  onClick={openMyPosts}
                  onKeyDown={handleMyPostsTriggerKeyDown}
                >
                  自分の投稿一覧
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="secondary"
                  ariaLabel="ランキング"
                  ref={rankingTriggerRef}
                  onClick={openRankingModal}
                >
                  ランキング
                </NeonButton>
                <NeonButton
                  ref={privacyPolicyTriggerRef}
                  type="button"
                  variant="secondary"
                  ariaLabel="プライバシーポリシー"
                  onClick={openPrivacyPolicy}
                >
                  プライバシーポリシー
                </NeonButton>
              </div>
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
                          {loadingMyPostIds.includes(postId) && <p>読み込み中...</p>}
                          {myPostDetails[postId] && (
                            <div>
                              <p>本文: {myPostDetails[postId].body}</p>
                              {typeof myPostDetails[postId].average_score === 'number' && (
                                <p>{myPostDetails[postId].average_score}</p>
                              )}
                              {typeof myPostDetails[postId].rank === 'number' && (
                                <p>{myPostDetails[postId].rank}位</p>
                              )}
                              <p>{myPostDetails[postId].created_at}</p>
                              <p>{myPostDetails[postId].status}</p>
                            </div>
                          )}
                          {myPostDetailErrors[postId] && (
                            <div>
                              <p>{myPostDetailErrors[postId]}</p>
                              <button type="button" onClick={() => retryMyPostDetail(postId)}>
                                再試行
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" onClick={() => closeMyPosts()} className="mt-4">
                    閉じる
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <PrivacyPolicyModal
          isOpen={viewMode === 'top' && isPrivacyPolicyOpen}
          onClose={closePrivacyPolicy}
          triggerRef={privacyPolicyTriggerRef}
        />

        <RankingModal
          isOpen={viewMode === 'top' && isRankingModalOpen}
          onClose={closeRankingModal}
          triggerRef={rankingTriggerRef}
          myPostIds={myPostIds}
          polling={isRankingModalOpen}
          onSelectRankingPost={handleRankingPostClick}
        />

        <ResultModal
          isOpen={isResultModalOpen}
          post={activeResultPost}
          isLoading={isResultModalLoading}
          errorCode={activeResultErrorCode}
          onRetry={retryResultModal}
          onPlayRetrySound={handlePlayRetrySound}
          onRejudgeSuccess={handleResultRejudgeSuccess}
          onClose={closeResultModal}
        />
      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
