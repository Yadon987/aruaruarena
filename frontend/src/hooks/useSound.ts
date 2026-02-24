const SOUND_STORAGE_KEY = 'aruaru_sound_muted'
const DEFAULT_MUTED = true
const FADE_DURATION_MS = 500

type Scene = 'top' | 'judging'
type SeId = 'se_submit' | 'se_result_open' | 'se_retry'

type DebugEvent =
  | { type: 'bgm'; scene: Scene }
  | { type: 'se'; id: SeId }

type FadeSpy = (from: number, to: number, durationMs: number) => void

function getOrInitMutedState(): boolean {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_MUTED
    const rawValue = localStorage.getItem(SOUND_STORAGE_KEY)
    if (rawValue === 'true') return true
    if (rawValue === 'false') return false

    localStorage.setItem(SOUND_STORAGE_KEY, DEFAULT_MUTED ? 'true' : 'false')
    return DEFAULT_MUTED
  } catch {
    return DEFAULT_MUTED
  }
}

function writeMutedState(isMuted: boolean) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SOUND_STORAGE_KEY, isMuted ? 'true' : 'false')
  } catch {
    // ストレージ無効環境ではメモリ上の状態だけを維持する。
  }
}

function pushAudioDebugEvent(event: DebugEvent) {
  const debugEvents = (globalThis as { __AUDIO_DEBUG__?: DebugEvent[] }).__AUDIO_DEBUG__
  if (!Array.isArray(debugEvents)) return
  debugEvents.push(event)
}

function runFade(from: number, to: number, durationMs: number) {
  const fadeSpy = (globalThis as { __HOWLER_FADE_SPY__?: FadeSpy }).__HOWLER_FADE_SPY__
  if (typeof fadeSpy === 'function') {
    fadeSpy(from, to, durationMs)
  }
}

export function createSoundController() {
  // 現在はE18段階の最小実装として、音声実再生ではなく状態管理とイベント通知に限定している。
  let isMuted = getOrInitMutedState()
  let audioUnlocked = false
  let currentScene: Scene | null = null

  return {
    get isMuted() {
      return isMuted
    },
    get audioUnlocked() {
      return audioUnlocked
    },
    setMuted(nextMuted: boolean) {
      isMuted = nextMuted
      writeMutedState(nextMuted)
      if (nextMuted) {
        // ミュート中は現在シーンを破棄し、解除後の同一シーン再生を許可する。
        currentScene = null
      }
    },
    unlockAudio() {
      audioUnlocked = true
    },
    playSceneBgm(scene: Scene) {
      if (!audioUnlocked || isMuted) return
      if (currentScene === scene) return

      if (currentScene) {
        runFade(1, 0, FADE_DURATION_MS)
      }
      currentScene = scene
      pushAudioDebugEvent({ type: 'bgm', scene })
    },
    playSe(id: SeId) {
      if (!audioUnlocked || isMuted) return
      pushAudioDebugEvent({ type: 'se', id })
    },
  }
}
