const SOUND_STORAGE_KEY = 'aruaru_sound_muted'
const DEFAULT_MUTED = true
const FADE_DURATION_MS = 500

type Scene = 'top' | 'judging'
type SeId = 'se_submit' | 'se_result_open' | 'se_retry'

type DebugEvent =
  | { type: 'bgm'; scene: Scene }
  | { type: 'se'; id: SeId }

type FadeSpy = (from: number, to: number, durationMs: number) => void

function readMutedState(): boolean {
  const rawValue = localStorage.getItem(SOUND_STORAGE_KEY)
  if (rawValue === 'true') return true
  if (rawValue === 'false') return false

  localStorage.setItem(SOUND_STORAGE_KEY, 'true')
  return DEFAULT_MUTED
}

function writeMutedState(isMuted: boolean) {
  localStorage.setItem(SOUND_STORAGE_KEY, isMuted ? 'true' : 'false')
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
  let isMuted = readMutedState()
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
