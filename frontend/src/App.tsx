import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { motion } from 'framer-motion'
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NeonButton } from './components/ui/NeonButton'
import { JudgeAvatars } from './features/judging/components/JudgeAvatars'
import { RankingModal } from './features/ranking'
import { ResultSummary } from './features/result/components/ResultSummary'
import { AudioConsentModal } from './features/top/components/AudioConsentModal'
import { MyPostDetail } from './features/top/components/MyPostDetail'
import { PostFormModal } from './features/top/components/PostFormModal'
import { PrivacyPolicyModal } from './features/top/components/PrivacyPolicyModal'
import { SoundControlButton } from './features/top/components/SoundControlButton'
import { SoundSettingsPanel } from './features/top/components/SoundSettingsPanel'
import { createSoundController } from './hooks/useSound'
import { queryClient } from './shared/config/queryClient'
import { DURATION, SCALE } from './shared/constants/animations'
import { API_ERROR_CODE, HTTP_STATUS } from './shared/constants/api'
import { DEFAULT_RANKING_LIMIT } from './shared/constants/query'
import { queryKeys } from './shared/constants/queryKeys'
import { SCORE_THRESHOLDS, TEXT_LENGTH } from './shared/constants/validation'
import { useAvatarImages } from './shared/hooks/useAvatarImages'
import { useFocusTrap } from './shared/hooks/useFocusTrap'
import { useReducedMotion } from './shared/hooks/useReducedMotion'
import { ApiClientError, api } from './shared/services/api'
import type { CreatePostResponse, GetHealthResponse } from './shared/types/api'
import type { JudgePersona, Post } from './shared/types/domain'
import { countGraphemeClusters } from './shared/utils'
import './App.css'

const STORAGE_KEY = 'my_post_ids'
const LEGACY_STORAGE_KEY = 'aruaruarena_my_posts'
const MAX_STORED_POST_IDS = 20
const SERVER_ERROR_STATUSES: ReadonlyArray<number> = [
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
]
const MESSAGE_NICKNAME_REQUIRED = 'ニックネームを入力してください'
const MESSAGE_NICKNAME_LENGTH = `ニックネームは${TEXT_LENGTH.NICKNAME_MIN}〜${TEXT_LENGTH.NICKNAME_MAX}文字で入力してください`
const MESSAGE_BODY_LENGTH = `本文は${TEXT_LENGTH.BODY_MIN}〜${TEXT_LENGTH.BODY_MAX}文字で入力してください`
const MESSAGE_BODY_REQUIRED = '本文を入力してください'
const MESSAGE_POST_NOT_FOUND = '投稿が見つかりませんでした'
const MESSAGE_MY_POST_DETAIL_FETCH_FAILED = '投稿詳細の取得に失敗しました'
const MESSAGE_POST_DETAIL_RATE_LIMITED = 'アクセスが集中しています。時間をおいて再度お試しください'
const MESSAGE_POST_DETAIL_SERVER_ERROR = '一時的なエラーです。時間をおいて再試行してください'
const MESSAGE_POST_DETAIL_NETWORK_ERROR = 'ネットワーク接続を確認してください'
const MESSAGE_RESULT_NOT_FINAL =
  '採点結果がまだ確定していません。しばらく時間をおいて再試行してください。'
const MESSAGE_JUDGING_FETCH_FAILED =
  '投稿情報の取得に失敗しました。トップへ戻って再度お試しください。'
const MESSAGE_JUDGING_NETWORK_ERROR = 'ネットワークに接続できませんでした'
const MESSAGE_JUDGING_BACKEND_NOT_RUNNING =
  'backendに接続できませんでした。backend を起動してください（bundle exec rails s）'
const MESSAGE_JUDGING_LOCAL_WORKER_NOT_RUNNING =
  'ローカル審査ワーカーが停止しています。bundle exec ruby scripts/run_judgment_worker.rb を起動してください'
const MESSAGE_JUDGING_TIMEOUT_ERROR = '通信がタイムアウトしました'
const MESSAGE_JUDGING_SERVER_ERROR = 'サーバーエラーが発生しました'
const MESSAGE_JUDGING_CLIENT_ERROR = '投稿に失敗しました'
const MESSAGE_JUDGING_UNKNOWN_ERROR = '投稿に失敗しました'
const MESSAGE_JUDGING_RETRY_GUIDE = '通信状況をご確認のうえ、再度お試しください。'
const MESSAGE_JUDGING_BACKEND_GUIDE = 'backend を起動後に、再度お試しください。'
const MESSAGE_JUDGING_LOCAL_WORKER_GUIDE =
  'backend を起動したうえで、ローカル審査ワーカーも起動してから再度お試しください。'
const DIALOG_CLOSE_KEY = 'Escape'
const OPEN_KEYS = ['Enter', ' '] as const
const ROOT_PATH = '/'
const SOUND_SETTINGS_PANEL_ID = 'sound-settings-panel'
const JUDGING_PATH_PREFIX = '/judging/'
const JUDGING_PATH_PATTERN = /^\/judging\/(.+)$/
const JUDGING_POLLING_INTERVAL_MS = 3000
const JUDGING_POLLING_TIMEOUT_MS =
  import.meta.env.MODE === 'development' && !isMockApiEnabled() ? 120000 : 60000
const JUDGING_TRANSIENT_ERROR_MAX_RETRIES = 4
const JUDGING_TRANSIENT_ERROR_MAX_DURATION_MS = 15000
const HEALTH_CHECK_TIMEOUT_MS = 3000
const AI_TRANSIENT_ERROR_CODES = [
  'provider_error',
  'connection_failed',
  'timeout',
  'secrets_fetch_failed',
]
const RESULT_MODAL_ERROR_NOT_FOUND = 'NOT_FOUND'
const RESULT_MODAL_ERROR_FETCH_FAILED = 'FETCH_ERROR'
const MESSAGE_REJUDGE_FAILED = '再審査に失敗しました。時間をおいて再度お試しください'
const DEFAULT_FAILED_PERSONAS: JudgePersona[] = ['hiroyuki', 'dewi', 'nakao']
const MAX_MY_POST_PREFETCH_CONCURRENCY = 3
const SOUND_SE_SUBMIT = 'se_submit'
const SOUND_SE_RETRY = 'se_retry'
const SOUND_SE_RESULT_OPEN = 'se_result_open'
const LOW_SCORE_THRESHOLD = SCORE_THRESHOLDS.LOW
const CONTACT_FORM_URL = 'https://forms.gle/zLN3j3YF87qdULXB9'
const FIXED_FOOTER_MIN_RESERVED_PX = 96
const FIXED_FOOTER_EXTRA_GAP_PX = 12
const SHAREABLE_RESULT_MAX_RANK = 20
const POST_SHARE_PATH_PREFIX = '/posts/'
const OGP_IMAGE_PATH_PREFIX = '/ogp/posts/'
const X_SHARE_INTENT_URL = 'https://twitter.com/intent/tweet'

type ValidationErrors = {
  nicknameError: string
  bodyError: string
}

type ViewMode = 'top' | 'judging' | 'result'
type ResultViewSource = 'judging' | 'ranking' | 'my_posts' | 'error' | 'unknown'

function shouldShowAudioConsentModalInTest(): boolean {
  return (
    (globalThis as { __SHOW_AUDIO_CONSENT_MODAL_IN_TEST__?: boolean })
      .__SHOW_AUDIO_CONSENT_MODAL_IN_TEST__ === true
  )
}

function canOpenResultModalFromMyPost(post: Post): boolean {
  return (
    (post.status === 'scored' || post.status === 'failed') && typeof post.total_count === 'number'
  )
}

function hasShareableRank(rank: number | undefined): rank is number {
  return (
    typeof rank === 'number' &&
    Number.isInteger(rank) &&
    rank >= 1 &&
    rank <= SHAREABLE_RESULT_MAX_RANK
  )
}

function isFinalResultPost(post: Post | null): post is Post & { status: 'scored' | 'failed' } {
  return post !== null && (post.status === 'scored' || post.status === 'failed')
}

function readFrontendBaseUrl(): string {
  const envBaseUrl = import.meta.env.VITE_FRONTEND_BASE_URL?.trim()
  return envBaseUrl && envBaseUrl.length > 0 ? envBaseUrl : window.location.origin
}

function buildFrontendAbsoluteUrl(pathname: string): string {
  const baseUrl = readFrontendBaseUrl()
  return new URL(pathname, `${baseUrl.replace(/\/+$/, '')}/`).toString()
}

function buildShareTargetUrl(postId: string): string {
  return buildFrontendAbsoluteUrl(`${POST_SHARE_PATH_PREFIX}${postId}`)
}

function buildOgpPreviewUrl(postId: string): string {
  return buildFrontendAbsoluteUrl(`${OGP_IMAGE_PATH_PREFIX}${postId}.png`)
}

function buildResultShareText(post: Post): string {
  const scoreLabel = typeof post.average_score === 'number' ? post.average_score.toFixed(1) : '--.-'
  const rankLabel = hasShareableRank(post.rank) ? `${post.rank}位` : 'ランクイン'
  return `「${post.body}」\n${post.nickname}さんのあるあるは ${rankLabel} / ${scoreLabel}点！\n#あるあるアリーナ`
}

function buildXShareIntentUrl(post: Post): string {
  const params = new URLSearchParams({
    text: buildResultShareText(post),
    url: buildShareTargetUrl(post.id),
  })
  return `${X_SHARE_INTENT_URL}?${params.toString()}`
}

function canShowPostJudgingShareActions(
  post: Post | null,
  source: ResultViewSource
): post is Post & { status: 'scored'; rank: number } {
  return (
    source === 'judging' &&
    isFinalResultPost(post) &&
    post.status === 'scored' &&
    hasShareableRank(post.rank)
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

function isTransientJudgingPollingError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) return false
  if (error.code === API_ERROR_CODE.NETWORK_ERROR || error.code === API_ERROR_CODE.TIMEOUT)
    return true
  return AI_TRANSIENT_ERROR_CODES.includes(error.code)
}

function shouldResolvePollingErrorViaHealth(reasonError: unknown): boolean {
  return (
    reasonError instanceof ApiClientError &&
    (reasonError.code === API_ERROR_CODE.NETWORK_ERROR ||
      reasonError.code === API_ERROR_CODE.TIMEOUT)
  )
}

function buildTransientErrorNotice(errorCount: number): string {
  if (errorCount >= JUDGING_TRANSIENT_ERROR_MAX_RETRIES - 1) {
    return `通信が不安定です（${errorCount}/${JUDGING_TRANSIENT_ERROR_MAX_RETRIES}）。まもなくタイムアウトします。`
  }
  return `通信が不安定です（${errorCount}/${JUDGING_TRANSIENT_ERROR_MAX_RETRIES}）。再接続を試しています...`
}

function validateForm(nickname: string, body: string): ValidationErrors {
  const trimmedNickname = nickname.trim()
  const trimmedBody = body.trim()
  const nicknameLength = countGraphemeClusters(trimmedNickname)
  const bodyLength = countGraphemeClusters(trimmedBody)

  const nicknameError =
    nicknameLength < TEXT_LENGTH.NICKNAME_MIN || nicknameLength > TEXT_LENGTH.NICKNAME_MAX
      ? MESSAGE_NICKNAME_LENGTH
      : ''
  const bodyError =
    trimmedBody.length === 0
      ? MESSAGE_BODY_REQUIRED
      : bodyLength < TEXT_LENGTH.BODY_MIN || bodyLength > TEXT_LENGTH.BODY_MAX
        ? MESSAGE_BODY_LENGTH
        : ''

  return {
    nicknameError: trimmedNickname ? nicknameError : MESSAGE_NICKNAME_REQUIRED,
    bodyError,
  }
}

function buildValidationErrorMessage({ nicknameError, bodyError }: ValidationErrors): string {
  return [nicknameError, bodyError].filter(Boolean).join('\n')
}

function isMockApiEnabled(): boolean {
  const value = import.meta.env.VITE_USE_MOCK_API
  if (typeof value !== 'string') return false

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes'
}

function isDevelopmentRealApiMode(): boolean {
  return import.meta.env.DEV && !isMockApiEnabled()
}

function isLocalWorkerUnavailable(health: GetHealthResponse): boolean {
  return health.worker?.mode === 'local_worker' && health.worker.status === 'unhealthy'
}

async function resolveJudgingPollingErrorMessage(reason: 'timeout' | 'generic'): Promise<string> {
  if (!isDevelopmentRealApiMode() || reason !== 'timeout') {
    return MESSAGE_JUDGING_FETCH_FAILED
  }

  try {
    const health = await api.health.get({ timeout: HEALTH_CHECK_TIMEOUT_MS })
    if (isLocalWorkerUnavailable(health)) {
      return MESSAGE_JUDGING_LOCAL_WORKER_NOT_RUNNING
    }
  } catch (error) {
    // 開発環境では health 到達不可を backend 未起動として案内し、切り分けを容易にする。
    if (
      error instanceof ApiClientError &&
      (error.code === API_ERROR_CODE.NETWORK_ERROR || error.code === API_ERROR_CODE.TIMEOUT)
    ) {
      return MESSAGE_JUDGING_BACKEND_NOT_RUNNING
    }
  }

  return MESSAGE_JUDGING_FETCH_FAILED
}

function resolveJudgingErrorGuide(message: string): string {
  if (message === MESSAGE_JUDGING_BACKEND_NOT_RUNNING) {
    return MESSAGE_JUDGING_BACKEND_GUIDE
  }
  if (message === MESSAGE_JUDGING_LOCAL_WORKER_NOT_RUNNING) {
    return MESSAGE_JUDGING_LOCAL_WORKER_GUIDE
  }
  return MESSAGE_JUDGING_RETRY_GUIDE
}

// APIクライアントの例外種別をUI文言へ変換する
function resolveJudgingSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === API_ERROR_CODE.NETWORK_ERROR) {
      return isDevelopmentRealApiMode()
        ? MESSAGE_JUDGING_BACKEND_NOT_RUNNING
        : MESSAGE_JUDGING_NETWORK_ERROR
    }
    if (error.code === API_ERROR_CODE.RATE_LIMITED || error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return MESSAGE_POST_DETAIL_RATE_LIMITED
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
  const prefersReducedMotion = useReducedMotion()
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [myPostIds, setMyPostIds] = useState<string[]>(() => readPostIds())
  const [isMyPostsOpen, setIsMyPostsOpen] = useState(false)
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false)
  const [myPostsError, setMyPostsError] = useState('')
  const [myPostDetails, setMyPostDetails] = useState<Record<string, Post>>({})
  const [myPostDetailErrors, setMyPostDetailErrors] = useState<Record<string, string>>({})
  const [loadingMyPostIds, setLoadingMyPostIds] = useState<string[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isLoadingPostDetail, setIsLoadingPostDetail] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('top')
  const [volume, setVolume] = useState(() => sound.volume)
  const [hasAudioConsent, setHasAudioConsent] = useState(() => sound.hasConsented)
  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState(false)
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [isFooterActionSheetOpen, setIsFooterActionSheetOpen] = useState(false)
  const [isStopJudgingConfirmOpen, setIsStopJudgingConfirmOpen] = useState(false)
  const [judgingPostId, setJudgingPostId] = useState('')
  const [judgingErrorMessage, setJudgingErrorMessage] = useState('')
  const [pendingFormData, setPendingFormData] = useState<{ nickname: string; body: string } | null>(
    null
  )
  const [activeResultPostId, setActiveResultPostId] = useState('')
  const [activeResultPost, setActiveResultPost] = useState<Post | null>(null)
  const [isResultPostLoading, setIsResultPostLoading] = useState(false)
  const [resultModalErrorCode, setResultModalErrorCode] = useState<string | null>(null)
  const [resultViewSource, setResultViewSource] = useState<ResultViewSource>('unknown')
  const [isRejudgeModalOpen, setIsRejudgeModalOpen] = useState(false)
  const [isRejudging, setIsRejudging] = useState(false)
  const [rejudgeErrorMessage, setRejudgeErrorMessage] = useState('')
  const [isJudgingPollingReady, setIsJudgingPollingReady] = useState(false)
  const [judgingTransientErrorCount, setJudgingTransientErrorCount] = useState(0)
  const [footerReservedSpace, setFooterReservedSpace] = useState(FIXED_FOOTER_MIN_RESERVED_PX)
  const inFlightPostIdsRef = useRef<Set<string>>(new Set())
  const myPostDetailsRef = useRef<Record<string, Post>>({})
  const myPostsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const privacyPolicyTriggerRef = useRef<HTMLButtonElement | null>(null)
  const rankingTriggerRef = useRef<HTMLButtonElement | null>(null)
  const footerActionSheetTriggerRef = useRef<HTMLButtonElement | null>(null)
  const footerDockRef = useRef<HTMLDivElement | null>(null)
  const soundSettingsContainerRef = useRef<HTMLDivElement | null>(null)
  const resultTriggerRef = useRef<HTMLElement | null>(null)
  const resultDialogRef = useRef<HTMLDivElement | null>(null)
  const myPostsModalRef = useRef<HTMLDivElement | null>(null)
  const footerActionSheetModalRef = useRef<HTMLDivElement | null>(null)
  const stopJudgingConfirmModalRef = useRef<HTMLDivElement | null>(null)
  const rejudgeModalRef = useRef<HTMLDivElement | null>(null)
  const resultRequestSeqRef = useRef(0)
  const previousResultViewActiveRef = useRef(false)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingStartedAtRef = useRef<number>(0)
  const pollingAbortControllerRef = useRef<AbortController | null>(null)
  const pollingRequestInFlightRef = useRef(false)
  const pollingTransientErrorCountRef = useRef<number>(0)
  const pollingTransientErrorStartedAtRef = useRef<number>(0)
  const submitAbortControllerRef = useRef<AbortController | null>(null)
  const submitRequestSeqRef = useRef(0)
  const activeResultErrorCode = resultModalErrorCode

  useEffect(() => {
    if (
      import.meta.env.MODE !== 'test' ||
      sound.hasConsented ||
      shouldShowAudioConsentModalInTest()
    ) {
      return
    }
    sound.setConsented()
    setHasAudioConsent(true)
  }, [sound])

  const resultAudioScene = useMemo(() => {
    if (viewMode !== 'result' || !activeResultPost) return null
    if (!isFinalResultPost(activeResultPost)) {
      return 'judging'
    }
    if (activeResultPost.status === 'failed') return 'failed'

    const avgScore = activeResultPost.average_score
    if (avgScore !== undefined && avgScore <= LOW_SCORE_THRESHOLD) {
      return 'low_score'
    }
    return 'success'
  }, [activeResultPost, viewMode])
  const audioScene = resultAudioScene ?? (viewMode === 'result' ? 'top' : viewMode)
  const isAudioConsentModalOpen =
    !hasAudioConsent && (import.meta.env.MODE !== 'test' || shouldShowAudioConsentModalInTest())
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
  const saveResultViewTrigger = useCallback(() => {
    resultTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [])
  const resetResultViewState = useCallback(() => {
    setActiveResultPost(null)
    setIsResultPostLoading(false)
    setResultModalErrorCode(null)
    setResultViewSource('unknown')
    setIsRejudgeModalOpen(false)
    setRejudgeErrorMessage('')
    setIsRejudging(false)
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
      if (cachedPost && isFinalResultPost(cachedPost)) {
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

  const enterResultView = useCallback(
    (
      postId: string,
      initialPost?: Post | null,
      options?: { source?: ResultViewSource }
    ) => {
      saveResultViewTrigger()
      setActiveResultPostId(postId)
      setResultModalErrorCode(null)
      setResultViewSource(options?.source ?? 'unknown')
      setRejudgeErrorMessage('')
      setIsRejudging(false)
      if (initialPost) {
        queryClient.setQueryData(queryKeys.posts.detail(postId), initialPost)
        setActiveResultPost(initialPost)
        setIsResultPostLoading(false)
        setIsRejudgeModalOpen(false)
      } else {
        setActiveResultPost(null)
        setIsRejudgeModalOpen(false)
        void fetchResultPost(postId)
      }
      setViewMode('result')
      syncTopPath()
    },
    [fetchResultPost, saveResultViewTrigger, syncTopPath]
  )

  const enterResultViewWithError = useCallback(
    (postId: string, errorCode: string, options?: { source?: ResultViewSource }) => {
      saveResultViewTrigger()
      setActiveResultPostId(postId)
      setActiveResultPost(null)
      setResultModalErrorCode(errorCode)
      setResultViewSource(options?.source ?? 'error')
      setIsResultPostLoading(false)
      setIsRejudgeModalOpen(false)
      setViewMode('result')
      syncTopPath()
    },
    [saveResultViewTrigger, syncTopPath]
  )

  const closeResultView = useCallback(() => {
    setViewMode('top')
    resetResultViewState()
    resultRequestSeqRef.current += 1
    requestAnimationFrame(() => {
      if (resultTriggerRef.current && document.body.contains(resultTriggerRef.current)) {
        resultTriggerRef.current.focus()
      }
    })
  }, [resetResultViewState])

  const retryResultViewFetch = useCallback(() => {
    if (!activeResultPostId) return
    void fetchResultPost(activeResultPostId, true)
  }, [activeResultPostId, fetchResultPost])

  const handlePlayRetrySound = useCallback(() => {
    sound.playSe(SOUND_SE_RETRY)
  }, [sound])

  const handleResultShareToX = useCallback(() => {
    if (!canShowPostJudgingShareActions(activeResultPost, resultViewSource)) return

    window.open(buildXShareIntentUrl(activeResultPost), '_blank', 'noopener,noreferrer')
  }, [activeResultPost, resultViewSource])

  const handleAudioConsent = useCallback(
    (nextVolume: number) => {
      sound.unlockAudio()
      sound.setConsented()
      sound.setVolume(nextVolume)
      setHasAudioConsent(true)
      setVolume(nextVolume)

      if (nextVolume > 0) {
        sound.playSceneBgm(audioScene)
      }
    },
    [audioScene, sound]
  )

  const handleSoundControlClick = useCallback(() => {
    sound.unlockAudio()
    if (!hasAudioConsent) {
      sound.setConsented()
      setHasAudioConsent(true)
    }
    setIsSoundSettingsOpen((prev) => !prev)
  }, [hasAudioConsent, sound])

  const handleVolumeChange = useCallback(
    (nextVolume: number) => {
      sound.unlockAudio()
      if (!hasAudioConsent) {
        sound.setConsented()
        setHasAudioConsent(true)
      }
      sound.setVolume(nextVolume)
      setVolume(nextVolume)
      if (nextVolume > 0) {
        setIsSoundSettingsOpen(true)
        sound.playSceneBgm(audioScene)
      }
    },
    [audioScene, hasAudioConsent, sound]
  )

  useEffect(() => {
    if (hasAudioConsent) return
    setIsSoundSettingsOpen(false)
  }, [hasAudioConsent])

  useEffect(() => {
    if (sound.audioUnlocked) return

    const handleUnlock = () => {
      sound.unlockAudio()
      if (sound.hasConsented && sound.volume > 0) {
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
    if (!hasAudioConsent || volume === 0) {
      sound.stopBgm()
      return
    }
    if (sound.audioUnlocked) {
      sound.playSceneBgm(audioScene)
    }
  }, [audioScene, hasAudioConsent, sound, volume])

  useEffect(() => {
    const isResultView = viewMode === 'result'
    if (!previousResultViewActiveRef.current && isResultView) {
      sound.playSe(SOUND_SE_RESULT_OPEN)
    }
    previousResultViewActiveRef.current = isResultView
  }, [sound, viewMode])

  useEffect(() => {
    if (!isRejudgeModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isRejudgeModalOpen])

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
    if (viewMode === 'judging') {
      setIsFooterActionSheetOpen(false)
    }
  }, [viewMode])

  const clearJudgingPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    if (pollingAbortControllerRef.current) {
      const abortController = pollingAbortControllerRef.current
      abortController.abort()
      if (pollingAbortControllerRef.current === abortController) {
        pollingAbortControllerRef.current = null
        pollingRequestInFlightRef.current = false
      }
    } else {
      pollingRequestInFlightRef.current = false
    }
    pollingStartedAtRef.current = 0
    pollingTransientErrorCountRef.current = 0
    pollingTransientErrorStartedAtRef.current = 0
    setJudgingTransientErrorCount(0)
  }, [])

  const abortSubmitRequest = useCallback(() => {
    submitAbortControllerRef.current?.abort()
    submitAbortControllerRef.current = null
  }, [])

  const invalidateSubmitRequest = useCallback(() => {
    submitRequestSeqRef.current += 1
    return submitRequestSeqRef.current
  }, [])

  useEffect(() => {
    return () => {
      abortSubmitRequest()
      sound.dispose()
    }
  }, [abortSubmitRequest, sound])

  const enterJudgingMode = useCallback((postId: string, isPollingReady: boolean = true) => {
    setJudgingPostId(postId)
    setJudgingErrorMessage('')
    setViewMode('judging')
    setIsJudgingPollingReady(isPollingReady)
  }, [])

  const startJudgingSubmission = useCallback(
    (temporaryPostId: string, nickname: string, body: string) => {
      // API確定前に審査中画面へ先に遷移し、体感速度を落とさずフィードバックする。
      setPendingFormData({ nickname, body })
      sound.playSe(SOUND_SE_SUBMIT)
      setIsPostModalOpen(false)
      enterJudgingMode(temporaryPostId, false)
      syncJudgingPath(temporaryPostId)
    },
    [enterJudgingMode, sound, syncJudgingPath]
  )

  const applyJudgingSubmitSuccess = useCallback(
    (response: CreatePostResponse) => {
      // 正式IDへ差し替えた後、レスポンス状態に応じて画面遷移を確定する。
      savePostId(response.id)
      syncMyPostIds()
      setJudgingPostId(response.id)
      syncJudgingPath(response.id)
      setIsJudgingPollingReady(true)

      if (response.status === 'failed') {
        // failed応答は結果画面へ直接遷移し、ポーリングは中断する。
        setJudgingErrorMessage('')
        enterResultView(response.id, null, { source: 'judging' })
        setIsJudgingPollingReady(false)
        return
      }

      // 審査中/queued など成功側は、暫定情報を残して審査待ちへ進める。
      enterJudgingMode(response.id, true)
    },
    [enterResultView, syncJudgingPath, syncMyPostIds, enterJudgingMode]
  )

  const applyJudgingSubmitFailure = useCallback((error: unknown) => {
    // API失敗時は入力値を保持したまま、再投稿導線へ戻す。
    console.error('Post creation failed:', error)
    setJudgingErrorMessage(resolveJudgingSubmitErrorMessage(error))
    setIsJudgingPollingReady(false)
  }, [])

  const handleResultRejudgeSuccess = useCallback(
    (post: Post) => {
      // 再審査開始がAPIで確定した場合のみ、審査中画面へ遷移する。
      closeResultView()
      enterJudgingMode(post.id)
      syncJudgingPath(post.id)
    },
    [closeResultView, enterJudgingMode, syncJudgingPath]
  )

  const handleResultRejudge = useCallback(async () => {
    if (!activeResultPost || activeResultPost.status !== 'failed' || isRejudging) return

    try {
      handlePlayRetrySound()
    } catch (error) {
      console.error('再審査SEの再生に失敗しました', error)
    }

    const judgments = activeResultPost.judgments
    const extractedFailedPersonas = judgments
      ?.filter((judgment) => !(judgment.success ?? false))
      .map((judgment) => judgment.persona)
    // judgments未取得時は既定順序の全員を再審査対象にし、
    // 取得済みで失敗者があればその一覧を、
    // 失敗者なしの場合は空配列として後続のエラーハンドリングへ進める。
    const failedPersonas: JudgePersona[] =
      judgments == null || judgments.length === 0
        ? DEFAULT_FAILED_PERSONAS
        : extractedFailedPersonas?.length
          ? extractedFailedPersonas
          : []

    setRejudgeErrorMessage('')
    setIsRejudging(true)

    try {
      if (failedPersonas.length === 0) {
        setRejudgeErrorMessage('再審査対象がありません')
        return
      }
      const response = await api.posts.rejudge(activeResultPost.id, failedPersonas)
      setIsRejudgeModalOpen(false)
      handleResultRejudgeSuccess({ ...activeResultPost, ...response })
    } catch (error) {
      setRejudgeErrorMessage(MESSAGE_REJUDGE_FAILED)
      console.error('再審査API呼び出しに失敗しました', error)
    } finally {
      setIsRejudging(false)
    }
  }, [activeResultPost, handlePlayRetrySound, handleResultRejudgeSuccess, isRejudging])

  const closeRejudgeModal = useCallback(() => {
    if (isRejudging) return
    setIsRejudgeModalOpen(false)
    setRejudgeErrorMessage('')
  }, [isRejudging])

  useEffect(() => {
    if (viewMode !== 'result') {
      setIsRejudgeModalOpen(false)
    }
  }, [viewMode])

  const closeResultAndBackTop = useCallback(() => {
    closeResultView()
    syncTopPath()
  }, [closeResultView, syncTopPath])

  const notFinalResultNotice = (
    <div className="glass-panel mx-auto w-full max-w-xl rounded-2xl p-6 text-center text-slate-100">
      <p className="text-sm font-semibold text-rose-100">{MESSAGE_RESULT_NOT_FINAL}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <NeonButton
          type="button"
          variant="secondary"
          compactOnMobile={true}
          ariaLabel="再試行"
          onClick={retryResultViewFetch}
        >
          再試行
        </NeonButton>
        <button
          type="button"
          onClick={closeResultAndBackTop}
          className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
        >
          トップへ戻る
        </button>
      </div>
    </div>
  )

  const exitJudgingWithResult = useCallback(
    (post: Post) => {
      clearJudgingPolling()
      setPendingFormData(null)
      setIsJudgingPollingReady(false)
      enterResultView(post.id, post, { source: 'judging' })
    },
    [clearJudgingPolling, enterResultView]
  )

  const exitJudgingWithError = useCallback((message: string = MESSAGE_JUDGING_FETCH_FAILED) => {
    clearJudgingPolling()
    setViewMode('judging')
    setIsJudgingPollingReady(false)
    setJudgingErrorMessage(message)
  }, [clearJudgingPolling])
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
      setViewMode('judging')
      setIsJudgingPollingReady(false)
      return
    }

    enterJudgingMode(routePostId)
  }, [enterJudgingMode, syncTopPath])

  useEffect(() => {
    if (viewMode !== 'judging' || !judgingPostId) return

    const handlePopState = () => {
      window.history.pushState({}, '', `${JUDGING_PATH_PREFIX}${judgingPostId}`)
      setIsStopJudgingConfirmOpen(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [judgingPostId, viewMode])

  useEffect(() => {
    if (viewMode !== 'judging') return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [viewMode])

  useEffect(() => {
    if (viewMode !== 'judging' || !judgingPostId || !isJudgingPollingReady) return

    let isDisposed = false
    let isFailing = false

    const handleJudgingFetchFailed = async (reason: 'timeout' | 'generic' = 'generic') => {
      if (isDisposed || isFailing) return
      isFailing = true
      const message = await resolveJudgingPollingErrorMessage(reason)
      if (isDisposed) return
      exitJudgingWithErrorRef.current(message)
    }

    const fetchPost = async () => {
      // 前回の取得中は次周期をスキップして、中断による取りこぼしを防ぐ。
      if (pollingRequestInFlightRef.current) return

      const elapsed = Date.now() - pollingStartedAtRef.current
      // 監視上限（JUDGING_POLLING_TIMEOUT_MS）を超えた場合はAPIを呼ばずに終端する。
      if (elapsed >= JUDGING_POLLING_TIMEOUT_MS) {
        await handleJudgingFetchFailed('timeout')
        return
      }

      pollingRequestInFlightRef.current = true
      const abortController = new AbortController()
      pollingAbortControllerRef.current = abortController

      try {
        const response = await api.posts.get(judgingPostId, {
          signal: abortController.signal,
        })
        if (isDisposed) return
        pollingTransientErrorCountRef.current = 0
        pollingTransientErrorStartedAtRef.current = 0
        setJudgingTransientErrorCount(0)
        if (response.status === 'scored' || response.status === 'failed') {
          exitJudgingWithResultRef.current(response)
          return
        }
      } catch (error) {
        if (isDisposed) return
        if (error instanceof ApiClientError && error.code === API_ERROR_CODE.ABORTED) return
        // 404は対象投稿が消失しているため即時終了とする。
        if (getErrorStatus(error) === HTTP_STATUS.NOT_FOUND) {
          handleJudgingFetchFailed()
          return
        }

        if (isTransientJudgingPollingError(error)) {
          if (pollingTransientErrorCountRef.current === 0) {
            pollingTransientErrorStartedAtRef.current = Date.now()
          }
          pollingTransientErrorCountRef.current += 1
          setJudgingTransientErrorCount(pollingTransientErrorCountRef.current)

          const transientElapsed = Date.now() - pollingTransientErrorStartedAtRef.current
          if (
            pollingTransientErrorCountRef.current >= JUDGING_TRANSIENT_ERROR_MAX_RETRIES ||
            transientElapsed >= JUDGING_TRANSIENT_ERROR_MAX_DURATION_MS
          ) {
            await handleJudgingFetchFailed(
              shouldResolvePollingErrorViaHealth(error) ? 'timeout' : 'generic'
            )
          }
          return
        }

        const retryElapsed = Date.now() - pollingStartedAtRef.current
        // 500系/通信系は監視上限（JUDGING_POLLING_TIMEOUT_MS）内で再試行し、超過時のみ終了する。
        if (retryElapsed >= JUDGING_POLLING_TIMEOUT_MS) {
          await handleJudgingFetchFailed(
            shouldResolvePollingErrorViaHealth(error) ? 'timeout' : 'generic'
          )
        }
      } finally {
        if (pollingAbortControllerRef.current === abortController) {
          pollingAbortControllerRef.current = null
          pollingRequestInFlightRef.current = false
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
      const submitRequestSeq = invalidateSubmitRequest()
      const submitAbortController = new AbortController()
      abortSubmitRequest()
      submitAbortControllerRef.current = submitAbortController

      const trimmedNickname = nickname.trim()
      const trimmedBody = body.trim()
      const { nicknameError: nextNicknameError, bodyError: nextBodyError } = validateForm(
        trimmedNickname,
        trimmedBody
      )

      setSubmitError('')
      setJudgingErrorMessage('')

      if (nextNicknameError || nextBodyError) {
        setSubmitError(
          buildValidationErrorMessage({
            nicknameError: nextNicknameError,
            bodyError: nextBodyError,
          })
        )
        return
      }

      // 楽観的UI: API待機中にフォームを閉じ、審査中画面へ先行遷移する。
      setIsSubmitting(true)
      const temporaryPostId = crypto.randomUUID()
      startJudgingSubmission(temporaryPostId, trimmedNickname, trimmedBody)
      try {
        const response = await api.posts.create(
          {
            nickname: trimmedNickname,
            body: trimmedBody,
          },
          {
            signal: submitAbortController.signal,
          }
        )
        if (submitRequestSeq !== submitRequestSeqRef.current) return
        applyJudgingSubmitSuccess(response)
      } catch (error) {
        if (submitRequestSeq !== submitRequestSeqRef.current) return
        if (error instanceof ApiClientError && error.code === API_ERROR_CODE.ABORTED) return
        applyJudgingSubmitFailure(error)
      } finally {
        if (submitAbortControllerRef.current === submitAbortController) {
          submitAbortControllerRef.current = null
        }
        if (submitRequestSeq === submitRequestSeqRef.current) {
          setIsSubmitting(false)
        }
      }
    },
    [
      abortSubmitRequest,
      applyJudgingSubmitFailure,
      applyJudgingSubmitSuccess,
      invalidateSubmitRequest,
      isSubmitting,
      startJudgingSubmission,
    ]
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
    setIsFooterActionSheetOpen(false)
    syncMyPostIds()
    setMyPostsError('')
    setIsPrivacyPolicyOpen(false)
    setIsRankingModalOpen(false)
    setIsMyPostsOpen(true)
    resetMyPostsModalState()
  }

  const closeMyPosts = useCallback(
    (restoreFocus: boolean = true) => {
      setIsMyPostsOpen(false)
      resetMyPostsModalState()
      if (restoreFocus) {
        // 明示クローズ時のみトリガーへ復帰し、結果モーダル遷移時はフォーカスを奪わない。
        myPostsTriggerRef.current?.focus()
      }
    },
    [resetMyPostsModalState]
  )

  const handleMyPostsTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (OPEN_KEYS.includes(event.key as (typeof OPEN_KEYS)[number])) {
      event.preventDefault()
      openMyPosts()
    }
  }

  const openPrivacyPolicy = () => {
    setIsFooterActionSheetOpen(false)
    setIsMyPostsOpen(false)
    setIsRankingModalOpen(false)
    resetMyPostsModalState()
    setIsPrivacyPolicyOpen(true)
  }

  const closePrivacyPolicy = () => {
    setIsPrivacyPolicyOpen(false)
  }

  const openContactForm = () => {
    setIsFooterActionSheetOpen(false)
    window.open(CONTACT_FORM_URL, '_blank', 'noopener,noreferrer')
  }

  const openRankingModal = () => {
    if (isRankingModalOpen) {
      closeRankingModal()
      return
    }
    setIsFooterActionSheetOpen(false)
    setIsMyPostsOpen(false)
    setIsPrivacyPolicyOpen(false)
    resetMyPostsModalState()
    setIsRankingModalOpen(true)
  }

  const prefetchRankings = useCallback(() => {
    const queryKey = queryKeys.rankings.list(DEFAULT_RANKING_LIMIT)
    if (queryClient.getQueryData(queryKey)) return

    void queryClient.prefetchQuery({
      queryKey,
      queryFn: () => api.rankings.list(DEFAULT_RANKING_LIMIT),
    })
  }, [])

  const closeRankingModal = () => {
    setIsRankingModalOpen(false)
  }

  const openFooterActionSheet = () => {
    if (isFooterActionSheetOpen) {
      closeFooterActionSheet()
      return
    }
    setIsMyPostsOpen(false)
    setIsPrivacyPolicyOpen(false)
    setIsRankingModalOpen(false)
    resetMyPostsModalState()
    setIsFooterActionSheetOpen(true)
  }

  const closeFooterActionSheet = () => {
    setIsFooterActionSheetOpen(false)
    footerActionSheetTriggerRef.current?.focus()
  }

  useFocusTrap({
    isActive: viewMode === 'result' && !isRejudgeModalOpen,
    containerRef: resultDialogRef,
    onEscape: closeResultAndBackTop,
  })

  useFocusTrap({
    isActive: viewMode !== 'judging' && isMyPostsOpen,
    containerRef: myPostsModalRef,
    onEscape: closeMyPosts,
  })

  useFocusTrap({
    isActive: viewMode !== 'judging' && isFooterActionSheetOpen,
    containerRef: footerActionSheetModalRef,
    onEscape: closeFooterActionSheet,
  })

  useFocusTrap({
    isActive: isRejudgeModalOpen,
    containerRef: rejudgeModalRef,
    onEscape: closeRejudgeModal,
  })

  useFocusTrap({
    isActive: isStopJudgingConfirmOpen,
    containerRef: stopJudgingConfirmModalRef,
    onEscape: () => setIsStopJudgingConfirmOpen(false),
  })

  useEffect(() => {
    if (!isFooterActionSheetOpen) return
    const rafId = window.requestAnimationFrame(() => {
      myPostsTriggerRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [isFooterActionSheetOpen])

  const retryPostSubmit = useCallback(() => {
    // 再投稿は入力復元を前提に、トップの投稿モーダルへ復帰するだけの導線に限定する。
    clearJudgingPolling()
    setSubmitError('')
    setViewMode('top')
    setIsPostModalOpen(true)
    syncTopPath()
  }, [clearJudgingPolling, syncTopPath])

  useEffect(() => {
    if (viewMode !== 'top' || !isPostModalOpen) return
    if (window.location.pathname === ROOT_PATH) return
    syncTopPath()
  }, [isPostModalOpen, syncTopPath, viewMode])

  const handlePostModalCloseWithDraft = useCallback((draft: { nickname: string; body: string }) => {
    const trimmedNickname = draft.nickname.trim()
    const trimmedBody = draft.body.trim()

    if (!trimmedNickname && !trimmedBody) {
      setPendingFormData(null)
      return
    }
    setPendingFormData({ nickname: trimmedNickname, body: trimmedBody })
  }, [])

  const backToTopFromJudgingError = useCallback(() => {
    clearJudgingPolling()
    setSubmitError('')
    setJudgingErrorMessage('')
    setViewMode('top')
    setIsPostModalOpen(false)
    syncTopPath()
  }, [clearJudgingPolling, syncTopPath])

  const resetToTopAfterJudgingStop = useCallback(() => {
    setPendingFormData(null)
    setSubmitError('')
    setJudgingErrorMessage('')
    setJudgingPostId('')
    setIsJudgingPollingReady(false)
    setIsPostModalOpen(false)
    setIsStopJudgingConfirmOpen(false)
    setViewMode('top')
    syncTopPath()
  }, [syncTopPath])

  const handleStopJudgingConfirm = useCallback(() => {
    clearJudgingPolling()
    abortSubmitRequest()
    invalidateSubmitRequest()
    setIsSubmitting(false)
    resetToTopAfterJudgingStop()
  }, [abortSubmitRequest, clearJudgingPolling, invalidateSubmitRequest, resetToTopAfterJudgingStop])

  const handleStopJudgingAndRepost = useCallback(() => {
    clearJudgingPolling()
    abortSubmitRequest()
    invalidateSubmitRequest()
    setIsSubmitting(false)
    setSubmitError('')
    setJudgingErrorMessage('')
    setJudgingPostId('')
    setIsJudgingPollingReady(false)
    setIsStopJudgingConfirmOpen(false)
    setViewMode('top')
    setIsPostModalOpen(true)
    syncTopPath()
  }, [abortSubmitRequest, clearJudgingPolling, invalidateSubmitRequest, syncTopPath])

  const handleRankingPostClick = (postId: string) => {
    setIsRankingModalOpen(false)
    enterResultView(postId, null, { source: 'ranking' })
  }

  const handleMyPostClick = async (postId: string) => {
    const cachedPost = myPostDetails[postId]
    if (cachedPost) {
      if (canOpenResultModalFromMyPost(cachedPost)) {
        closeMyPosts(false)
        enterResultView(postId, cachedPost, { source: 'my_posts' })
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
        enterResultView(postId, response, { source: 'my_posts' })
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
        enterResultViewWithError(postId, resolveResultModalErrorCode(error), {
          source: 'my_posts',
        })
      } else {
        setMyPostDetailErrors((prev) => ({
          ...prev,
          [postId]: MESSAGE_MY_POST_DETAIL_FETCH_FAILED,
        }))
        if (shouldOpenResultModalOnMyPostError(status)) {
          closeMyPosts(false)
          enterResultViewWithError(postId, resolveResultModalErrorCode(error), {
            source: 'my_posts',
          })
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
  const judgingPhase: 'entrance' | 'speaking' | 'scoring' | 'complete' =
    viewMode === 'judging'
      ? 'scoring'
      : activeResultPost?.status === 'scored' || activeResultPost?.status === 'failed'
        ? 'complete'
        : 'complete'
  const shareableResultPost = useMemo(() => {
    if (!canShowPostJudgingShareActions(activeResultPost, resultViewSource)) return null
    return activeResultPost
  }, [activeResultPost, resultViewSource])

  useEffect(() => {
    if (!isMyPostsOpen) return
    void prefetchMyPostsDetails(prefetchTargetPostIds)
  }, [isMyPostsOpen, prefetchMyPostsDetails, prefetchTargetPostIds])

  useEffect(() => {
    if (!isStopJudgingConfirmOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== DIALOG_CLOSE_KEY) return
      event.preventDefault()
      setIsStopJudgingConfirmOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isStopJudgingConfirmOpen])

  useEffect(() => {
    if (viewMode !== 'top') {
      setFooterReservedSpace(FIXED_FOOTER_MIN_RESERVED_PX)
      return
    }

    const dockElement = footerDockRef.current
    if (!dockElement) return

    const updateFooterReservedSpace = () => {
      const dockHeight = Math.ceil(dockElement.getBoundingClientRect().height)
      const bottomOffset = Math.ceil(parseFloat(getComputedStyle(dockElement).bottom) || 0)
      const nextReservedSpace = Math.max(
        FIXED_FOOTER_MIN_RESERVED_PX,
        dockHeight + bottomOffset + FIXED_FOOTER_EXTRA_GAP_PX
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
    observer.observe(dockElement)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateFooterReservedSpace)
    }
  }, [viewMode])

  return (
    <QueryClientProvider client={queryClient}>
      <AudioConsentModal isOpen={isAudioConsentModalOpen} onConsent={handleAudioConsent} />
      {viewMode === 'judging' && (
        <div className="fixed left-4 top-4 z-50 sm:left-6 sm:top-6">
          <NeonButton
            type="button"
            variant="secondary"
            compactOnMobile={true}
            ariaLabel="審査を停止してホームに戻る"
            onClick={() => setIsStopJudgingConfirmOpen(true)}
          >
            ホームへ戻る
          </NeonButton>
        </div>
      )}
      <div
        data-testid="top-action-controls"
        className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6"
      >
        <div className="top-right-action-stack">
          <div ref={soundSettingsContainerRef} className="relative">
            <SoundControlButton
              volume={volume}
              isOpen={isSoundSettingsOpen}
              onClick={handleSoundControlClick}
              panelId={SOUND_SETTINGS_PANEL_ID}
            />
            <SoundSettingsPanel
              isOpen={isSoundSettingsOpen}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              onClose={() => setIsSoundSettingsOpen(false)}
              panelId={SOUND_SETTINGS_PANEL_ID}
              containerRef={soundSettingsContainerRef}
            />
          </div>
          {viewMode !== 'judging' && viewMode !== 'result' && (
            <>
              <button
                type="button"
                onMouseEnter={prefetchRankings}
                onFocus={prefetchRankings}
                onClick={openRankingModal}
                aria-label="ランキング"
                title="ランキング"
                className="neon-button-base neon-glow-pink icon-action-button"
                ref={rankingTriggerRef}
              >
                <span aria-hidden="true">🏆</span>
              </button>
              <button
                type="button"
                onClick={openFooterActionSheet}
                aria-label="その他を開く"
                title="その他"
                className="neon-button-base neon-glow-pink icon-action-button"
                ref={footerActionSheetTriggerRef}
              >
                <span aria-hidden="true">⚙️</span>
              </button>
            </>
          )}
        </div>
      </div>
      <div
        className="game-show-stage relative min-h-screen overflow-hidden px-6 pb-6"
        style={{ isolation: 'isolate', paddingBottom: `${footerReservedSpace}px` }}
      >
        {viewMode === 'judging' && !judgingErrorMessage && (
          <section data-testid="judging-screen" aria-label="審査中" className="sr-only" />
        )}
        {viewMode === 'judging' && !judgingErrorMessage && judgingTransientErrorCount > 0 && (
          <div className="pointer-events-none fixed left-1/2 top-5 z-[125] -translate-x-1/2">
            <p
              aria-live="polite"
              className="rounded-full border border-rose-300/70 bg-white/90 px-4 py-2 text-sm font-semibold text-red-600 shadow-[0_8px_20px_rgba(15,23,42,0.14)] backdrop-blur"
            >
              {buildTransientErrorNotice(judgingTransientErrorCount)}
            </p>
          </div>
        )}
        {viewMode === 'judging' && judgingErrorMessage && (
          <section
            data-testid="judging-screen"
            aria-label="審査エラー"
            aria-live="assertive"
            className="relative z-[120] mx-auto mt-20 w-full max-w-xl"
          >
            <div className="rounded-2xl border border-rose-300/60 bg-white/95 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.16)] backdrop-blur">
              <div className="flex items-start gap-3">
                <div
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-lg text-rose-700"
                >
                  !
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                    読み込みに失敗しました
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-700">{judgingErrorMessage}</p>
                  <p className="text-xs text-slate-500">
                    {resolveJudgingErrorGuide(judgingErrorMessage)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={backToTopFromJudgingError}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  トップへ戻る
                </button>
                <NeonButton ariaLabel="再投稿する" onClick={retryPostSubmit}>
                  再投稿する
                </NeonButton>
              </div>
            </div>
          </section>
        )}

        {viewMode === 'top' && (
          <>
            <PostFormModal
              isOpen={isPostModalOpen}
              onClose={() => setIsPostModalOpen(false)}
              onCloseWithDraft={handlePostModalCloseWithDraft}
              onSubmit={onSubmit}
              isLoading={isSubmitting}
              error={submitError}
              initialNickname={pendingFormData?.nickname ?? ''}
              initialBody={pendingFormData?.body ?? ''}
            />
          </>
        )}

        {viewMode === 'result' && (
          <div
            data-testid="result-screen"
            role="dialog"
            aria-modal="true"
            aria-label="審査結果モーダル"
            ref={resultDialogRef}
            tabIndex={-1}
            className="relative z-[120] mx-auto mt-16 w-full max-w-4xl px-1 pb-6 sm:mt-20"
          >
            {isResultPostLoading && !activeResultPost && (
              <div className="glass-panel mx-auto w-full max-w-xl rounded-2xl p-6 text-center text-slate-100">
                投稿結果を読み込み中です...
              </div>
            )}
            {!isResultPostLoading && activeResultErrorCode && (
              <div className="glass-panel mx-auto w-full max-w-xl rounded-2xl p-6 text-center">
                <p className="text-sm font-semibold text-rose-100">
                  {activeResultErrorCode === RESULT_MODAL_ERROR_NOT_FOUND
                    ? MESSAGE_POST_NOT_FOUND
                    : MESSAGE_POST_DETAIL_SERVER_ERROR}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <NeonButton
                    type="button"
                    variant="secondary"
                    compactOnMobile={true}
                    ariaLabel="再試行"
                    onClick={retryResultViewFetch}
                  >
                    再試行
                  </NeonButton>
                  <button
                    type="button"
                    onClick={closeResultAndBackTop}
                    className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
                  >
                    トップへ戻る
                  </button>
                </div>
              </div>
            )}
            {!isResultPostLoading &&
              !activeResultErrorCode &&
              !isFinalResultPost(activeResultPost) &&
              notFinalResultNotice}
            {!isResultPostLoading &&
              !activeResultErrorCode &&
              activeResultPost &&
              isFinalResultPost(activeResultPost) && (
                <ResultSummary
                  nickname={activeResultPost.nickname}
                  body={activeResultPost.body}
                  rank={activeResultPost.rank}
                  totalCount={activeResultPost.total_count}
                  averageScore={activeResultPost.average_score}
                  status={activeResultPost.status}
                  onRejudge={handleResultRejudge}
                  onClose={closeResultAndBackTop}
                  isRejudging={isRejudging}
                  rejudgeErrorMessage={rejudgeErrorMessage}
                  onShareToX={shareableResultPost ? handleResultShareToX : undefined}
                  ogpPreviewUrl={
                    shareableResultPost ? buildOgpPreviewUrl(shareableResultPost.id) : undefined
                  }
                />
              )}
          </div>
        )}

        {viewMode !== 'judging' && isMyPostsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="自分の投稿を閉じる"
              className="modal-overlay-gorgeous absolute inset-0"
              onClick={() => closeMyPosts()}
            />
            <motion.div
              ref={myPostsModalRef}
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
              transition={{ duration: DURATION.MODAL }}
              role="dialog"
              aria-modal="true"
              aria-label="自分の投稿"
              tabIndex={-1}
              className="modal-gorgeous-base relative z-10 w-full max-w-md rounded-2xl p-4 text-slate-100"
            >
              {selectedPost ? (
                <MyPostDetail
                  post={selectedPost}
                  onBack={() => setSelectedPost(null)}
                  onClose={closeMyPosts}
                />
              ) : (
                <>
                  <div className="modal-header-gorgeous flex items-center justify-between gap-4">
                    <h2 className="gold-text text-lg font-semibold">自分の投稿</h2>
                    <button
                      type="button"
                      onClick={() => closeMyPosts()}
                      className="text-sm font-semibold text-slate-300 transition hover:text-white"
                    >
                      閉じる
                    </button>
                  </div>
                  {myPostsError && <p className="mb-3 text-rose-200">{myPostsError}</p>}
                  {isLoadingPostDetail && (
                    <p className="mb-3 text-slate-200">投稿詳細を読み込み中です...</p>
                  )}
                  {displayMyPostIds.length === 0 ? (
                    <p className="text-slate-200">投稿するとここに表示されます</p>
                  ) : (
                    <ul className="modal-scroll-area max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                      {displayMyPostIds.map((postId) => (
                        <li key={postId} data-testid="my-post-id-item">
                          <button
                            type="button"
                            className="text-left font-semibold text-amber-100 underline-offset-2 hover:underline"
                            onClick={() => handleMyPostClick(postId)}
                          >
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
                </>
              )}
            </motion.div>
          </div>
        )}

        <PrivacyPolicyModal
          isOpen={viewMode !== 'judging' && isPrivacyPolicyOpen}
          onClose={closePrivacyPolicy}
          triggerRef={privacyPolicyTriggerRef}
        />

        <RankingModal
          isOpen={viewMode !== 'judging' && isRankingModalOpen}
          onClose={closeRankingModal}
          triggerRef={rankingTriggerRef}
          myPostIds={myPostIds}
          polling={isRankingModalOpen}
          onSelectRankingPost={handleRankingPostClick}
        />

        {viewMode !== 'judging' && isFooterActionSheetOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3">
            <button
              type="button"
              aria-label="補助メニューを閉じる"
              className="modal-overlay-gorgeous absolute inset-0"
              onClick={closeFooterActionSheet}
            />
            <motion.div
              ref={footerActionSheetModalRef}
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
              transition={{ duration: DURATION.MODAL }}
              role="dialog"
              aria-modal="true"
              aria-label="補助メニュー"
              className="modal-gorgeous-base w-full max-w-md rounded-2xl p-4 text-slate-100 shadow-2xl"
            >
              <div className="modal-header-gorgeous">
                <p className="gold-text text-sm font-semibold">補助メニュー</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <NeonButton
                  ref={myPostsTriggerRef}
                  type="button"
                  variant="primary"
                  compactOnMobile={true}
                  ariaLabel="過去の投稿"
                  onClick={openMyPosts}
                  onKeyDown={handleMyPostsTriggerKeyDown}
                >
                  過去の投稿
                </NeonButton>
                <NeonButton
                  ref={privacyPolicyTriggerRef}
                  type="button"
                  variant="secondary"
                  compactOnMobile={true}
                  ariaLabel="プライバシーポリシー"
                  onClick={openPrivacyPolicy}
                >
                  プライバシーポリシー
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="secondary"
                  compactOnMobile={true}
                  ariaLabel="問い合わせ（新しいタブで開く）"
                  onClick={openContactForm}
                >
                  問い合わせ
                </NeonButton>
                <button
                  type="button"
                  className="mt-1 rounded-xl border border-amber-200/35 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-black/30"
                  aria-label="補助メニューを閉じる"
                  onClick={closeFooterActionSheet}
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {viewMode === 'judging' && isStopJudgingConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="審査停止確認を閉じる"
              className="modal-overlay-gorgeous absolute inset-0"
              onClick={() => setIsStopJudgingConfirmOpen(false)}
            />
            <motion.div
              ref={stopJudgingConfirmModalRef}
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
              transition={{ duration: DURATION.MODAL }}
              className="modal-gorgeous-base w-full max-w-sm rounded-2xl p-4 text-slate-100"
              role="dialog"
              aria-modal="true"
              aria-label="審査停止確認"
            >
              <div className="modal-header-gorgeous">
                <h2 className="gold-text text-lg font-semibold">審査を中止しますか？</h2>
              </div>
              <p className="mb-4 text-sm text-slate-100">
                中止する場合は投稿内容を破棄します。再投稿する場合は入力内容を保持したまま戻れます。
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <NeonButton
                  type="button"
                  variant="secondary"
                  compactOnMobile={true}
                  ariaLabel="審査を続ける"
                  onClick={() => setIsStopJudgingConfirmOpen(false)}
                >
                  続ける
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="secondary"
                  compactOnMobile={true}
                  ariaLabel="再投稿する"
                  onClick={handleStopJudgingAndRepost}
                >
                  再投稿する
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="primary"
                  compactOnMobile={true}
                  ariaLabel="中止する"
                  onClick={handleStopJudgingConfirm}
                >
                  中止する
                </NeonButton>
              </div>
            </motion.div>
          </div>
        )}
        {viewMode === 'result' && isRejudgeModalOpen && activeResultPost?.status === 'failed' && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="再審査確認を閉じる"
              className="modal-overlay-gorgeous absolute inset-0"
              onClick={closeRejudgeModal}
            />
            <motion.div
              ref={rejudgeModalRef}
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
              transition={{ duration: DURATION.MODAL }}
              className="modal-gorgeous-base w-full max-w-sm rounded-2xl p-5 text-slate-100"
              role="dialog"
              aria-modal="true"
              aria-label="再審査確認"
              tabIndex={-1}
            >
              <div className="modal-header-gorgeous">
                <h2 className="gold-text text-lg font-bold">審査に失敗しました</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-100">
                判定の取得に失敗した審査員がいます。再審査を実行しますか？
              </p>
              {rejudgeErrorMessage && (
                <p className="mt-2 text-sm text-rose-200">{rejudgeErrorMessage}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <NeonButton
                  type="button"
                  variant="secondary"
                  compactOnMobile={true}
                  ariaLabel="閉じる"
                  onClick={closeRejudgeModal}
                  disabled={isRejudging}
                >
                  閉じる
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="primary"
                  compactOnMobile={true}
                  ariaLabel="再審査する"
                  onClick={handleResultRejudge}
                  disabled={isRejudging}
                >
                  {isRejudging ? '再審査中...' : '再審査する'}
                </NeonButton>
              </div>
            </motion.div>
          </div>
        )}
        <div
          ref={footerDockRef}
          className={`fixed inset-x-0 z-30 pointer-events-none ${
            viewMode === 'top'
              ? 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] px-2 sm:bottom-5 sm:px-3 md:bottom-6 md:px-4 lg:bottom-10 lg:px-6'
              : viewMode === 'result'
                ? 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] px-2 sm:bottom-8 sm:px-3 md:bottom-10 md:px-4 lg:bottom-12 lg:px-6'
                : 'bottom-24 px-2 sm:bottom-24 sm:px-3 md:bottom-24 md:px-4 lg:bottom-10 lg:px-6'
          }`}
        >
          <div className="mx-auto w-full max-w-6xl flex flex-col items-center gap-0">
            <div data-testid="top-judge-dock" className="w-full pointer-events-none">
              <JudgeAvatars
                isJudging={viewMode === 'judging'}
                isPostModalOpen={isPostModalOpen}
                enableIdleBehavior={viewMode === 'top'}
                judgments={viewMode === 'judging' ? activeResultPost?.judgments : undefined}
                resultMode={viewMode === 'result'}
                resultJudgments={activeResultPost?.judgments}
                isLowScore={
                  isFinalResultPost(activeResultPost) &&
                  activeResultPost.status === 'scored' &&
                  activeResultPost.average_score !== undefined &&
                  activeResultPost.average_score <= LOW_SCORE_THRESHOLD
                }
                judgingPhase={judgingPhase}
                compactBottomSpacing={true}
              />
            </div>
            {viewMode === 'top' && (
              <div className="pointer-events-auto mt-2 sm:mt-3 md:mt-4 lg:mt-5">
                <NeonButton
                  type="button"
                  variant="primary"
                  className="center-submit-cta"
                  ariaLabel="投稿する"
                  onClick={() => {
                    setSubmitError('')
                    setIsPostModalOpen(true)
                  }}
                >
                  投稿する
                </NeonButton>
              </div>
            )}
          </div>
        </div>
      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
