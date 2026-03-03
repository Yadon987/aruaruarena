import { Howl } from 'howler'

const SOUND_STORAGE_KEY = 'aruaru_sound_muted'
const DEFAULT_MUTED = true
const FADE_DURATION_MS = 500
const BGM_VOLUME = 0.5
const SE_VOLUME = 0.7

type Scene = 'top' | 'judging' | 'success' | 'failed'
type SeId = 'se_submit' | 'se_result_open' | 'se_retry'

type DebugEvent =
  | { type: 'bgm'; scene: Scene }
  | { type: 'se'; id: SeId }

type FadeSpy = (from: number, to: number, durationMs: number) => void

const BGM_FILES: Record<Scene, string> = {
  top: '/sounds/radetzky_march.mp3',
  judging: '/sounds/CanCan.mp3',
  success: '/sounds/pomp_and_circumstance.mp3',
  failed: '/sounds/fate_theme.mp3',
}

const SE_FILES: Record<SeId, string> = {
  se_submit: '/sounds/se_submit.mp3',
  se_result_open: '/sounds/se_result_open.mp3',
  se_retry: '/sounds/se_retry.mp3',
}

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

function runFade(howl: Howl | null, from: number, to: number, durationMs: number) {
  const fadeSpy = (globalThis as { __HOWLER_FADE_SPY__?: FadeSpy }).__HOWLER_FADE_SPY__
  if (typeof fadeSpy === 'function') {
    fadeSpy(from, to, durationMs)
  }
  if (howl) {
    howl.fade(from, to, durationMs)
  }
}

export function createSoundController() {
  let isMuted = getOrInitMutedState()
  let audioUnlocked = false
  let currentScene: Scene | null = null
  let currentBgm: Howl | null = null
  let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null

  const clearPendingTimeout = () => {
    if (pendingTimeoutId !== null) {
      clearTimeout(pendingTimeoutId)
      pendingTimeoutId = null
    }
  }

  const stopBgm = () => {
    clearPendingTimeout()
    if (currentBgm) {
      currentBgm.stop()
      currentBgm.unload()
      currentBgm = null
    }
    currentScene = null
  }

  const dispose = () => {
    stopBgm()
  }

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

      if (nextMuted && currentBgm) {
        runFade(currentBgm, BGM_VOLUME, 0, FADE_DURATION_MS)
        clearPendingTimeout()
        pendingTimeoutId = setTimeout(() => {
          stopBgm()
        }, FADE_DURATION_MS)
      }

      if (!nextMuted) {
        clearPendingTimeout()
      }

      if (nextMuted && !currentBgm) {
        currentScene = null
      }
    },
    unlockAudio() {
      audioUnlocked = true
    },
    stopBgm,
    dispose,
    playSceneBgm(scene: Scene) {
      if (!audioUnlocked || isMuted) return
      if (currentScene === scene) return

      clearPendingTimeout()

      if (currentBgm) {
        const previousBgm = currentBgm
        runFade(previousBgm, BGM_VOLUME, 0, FADE_DURATION_MS)
        setTimeout(() => {
          previousBgm.unload()
        }, FADE_DURATION_MS)
        currentBgm = null
      }

      currentScene = scene
      currentBgm = new Howl({
        src: [BGM_FILES[scene]],
        loop: scene !== 'success' && scene !== 'failed',
        volume: BGM_VOLUME,
        onloaderror: () => {
          console.error('[Sound] BGM load error:', scene)
        },
        onplayerror: () => {
          console.error('[Sound] BGM play error:', scene)
        },
        onend: () => {
          if (scene !== 'success' && scene !== 'failed') return
          if (currentBgm) {
            currentBgm.unload()
            currentBgm = null
          }
          currentScene = null
        },
      })
      currentBgm.play()
      pushAudioDebugEvent({ type: 'bgm', scene })
    },
    playSe(id: SeId) {
      if (!audioUnlocked || isMuted) return

      const se = new Howl({
        src: [SE_FILES[id]],
        volume: SE_VOLUME,
        onloaderror: () => {
          console.error('[Sound] SE load error:', id)
        },
        onplayerror: () => {
          console.error('[Sound] SE play error:', id)
        },
        onend: () => {
          se.unload()
        },
      })
      se.play()
      pushAudioDebugEvent({ type: 'se', id })
    },
  }
}
