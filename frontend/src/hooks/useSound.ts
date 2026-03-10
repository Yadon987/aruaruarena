import { Howl } from 'howler'

const SOUND_VOLUME_KEY = 'aruaru_sound_volume'
const SOUND_CONSENT_KEY = 'aruaru_sound_consent'
export const DEFAULT_VOLUME = 0.6
const FADE_DURATION_MS = 500

type Scene = 'top' | 'judging' | 'success' | 'failed'
type SeId = 'se_submit' | 'se_result_open' | 'se_retry'

type DebugEvent = { type: 'bgm'; scene: Scene } | { type: 'se'; id: SeId }

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

function normalizeVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  if (value < 0) return 0
  if (value > 1) return 1
  return Math.round(value * 100) / 100
}

function getOrInitVolume(): number {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_VOLUME

    const rawValue = localStorage.getItem(SOUND_VOLUME_KEY)
    if (rawValue === null) {
      localStorage.setItem(SOUND_VOLUME_KEY, String(DEFAULT_VOLUME))
      return DEFAULT_VOLUME
    }

    const parsed = Number(rawValue)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      return normalizeVolume(parsed)
    }

    localStorage.setItem(SOUND_VOLUME_KEY, String(DEFAULT_VOLUME))
    return DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

function writeVolume(value: number) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SOUND_VOLUME_KEY, String(normalizeVolume(value)))
  } catch {
    // ストレージ無効環境ではメモリ上の状態だけを維持する。
  }
}

function readConsentFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(SOUND_CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

function setConsent() {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SOUND_CONSENT_KEY, 'true')
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
  let volume = getOrInitVolume()
  let hasConsented = readConsentFromStorage()
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
    get volume() {
      return volume
    },
    get hasConsented() {
      return hasConsented
    },
    get audioUnlocked() {
      return audioUnlocked
    },
    setConsented() {
      hasConsented = true
      setConsent()
    },
    setVolume(nextVolume: number) {
      volume = normalizeVolume(nextVolume)
      writeVolume(volume)

      if (volume === 0) {
        stopBgm()
        return
      }

      if (currentBgm) {
        currentBgm.volume(volume)
      }
    },
    unlockAudio() {
      audioUnlocked = true
    },
    stopBgm,
    dispose,
    playSceneBgm(scene: Scene) {
      if (!audioUnlocked || volume === 0) return
      if (currentScene === scene) return

      clearPendingTimeout()

      if (currentBgm) {
        const previousBgm = currentBgm
        runFade(previousBgm, previousBgm.volume(), 0, FADE_DURATION_MS)
        setTimeout(() => {
          previousBgm.unload()
        }, FADE_DURATION_MS)
        currentBgm = null
      }

      currentScene = scene
      const nextBgm = new Howl({
        src: [BGM_FILES[scene]],
        loop: scene !== 'success' && scene !== 'failed',
        volume,
        onloaderror: () => {
          console.error('[Sound] BGM load error:', scene)
          if (currentBgm !== nextBgm) return
          nextBgm.unload()
          currentBgm = null
          currentScene = null
        },
        onplayerror: () => {
          console.error('[Sound] BGM play error:', scene)
          if (currentBgm !== nextBgm) return
          nextBgm.unload()
          currentBgm = null
          currentScene = null
        },
        onend: () => {
          if (scene !== 'success' && scene !== 'failed') return
          if (currentBgm !== nextBgm) return
          nextBgm.unload()
          currentBgm = null
          currentScene = null
        },
      })
      currentBgm = nextBgm
      nextBgm.play()
      pushAudioDebugEvent({ type: 'bgm', scene })
    },
    playSe(id: SeId) {
      if (!audioUnlocked || volume === 0) return

      const se = new Howl({
        src: [SE_FILES[id]],
        volume,
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
