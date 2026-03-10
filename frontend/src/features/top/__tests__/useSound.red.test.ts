import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type UseSoundModule = {
  DEFAULT_VOLUME: number
  createSoundController: () => {
    volume: number
    hasConsented: boolean
    audioUnlocked: boolean
    setVolume: (value: number) => void
    setConsented: () => void
    unlockAudio: () => void
    playSceneBgm: (scene: 'top' | 'judging') => void
    playSe: (id: 'se_submit' | 'se_result_open' | 'se_retry') => void
  }
}

async function loadUseSoundModule(): Promise<UseSoundModule> {
  const module = await import('../../../hooks/useSound')
  if (typeof module.createSoundController !== 'function') {
    throw new Error('useSound module does not export createSoundController')
  }
  return module as UseSoundModule
}

describe('E18 RED: useSound', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初期値はvolume=0.6で開始する', async () => {
    // 何を検証するか: 初回アクセス時に volume が 0.6 で初期化されること
    const module = await loadUseSoundModule()
    const sound = module.createSoundController()

    expect(sound.volume).toBe(module.DEFAULT_VOLUME)
    expect(sound.audioUnlocked).toBe(false)
    expect(sound.hasConsented).toBe(false)
  })

  it('localStorageが0なら無音状態を復元する', async () => {
    // 何を検証するか: aruaru_sound_volume が 0 の場合に volume=0 で復元されること
    localStorage.setItem('aruaru_sound_volume', '0')

    const module = await loadUseSoundModule()
    const sound = module.createSoundController()

    expect(sound.volume).toBe(0)
  })

  it('不正なlocalStorage値は0.6に正規化する', async () => {
    // 何を検証するか: 不正値で起動した場合に 0.6 へ正規化して保存し直すこと
    localStorage.setItem('aruaru_sound_volume', 'invalid')

    const module = await loadUseSoundModule()
    module.createSoundController()

    expect(localStorage.getItem('aruaru_sound_volume')).toBe(String(module.DEFAULT_VOLUME))
  })

  it('シーン変更時に500msクロスフェードを実行する', async () => {
    // 何を検証するか: top -> judging 遷移で 500ms のクロスフェードが発生すること
    vi.useFakeTimers()
    const fadeSpy = vi.fn()
    vi.stubGlobal('__HOWLER_FADE_SPY__', fadeSpy)
    vi.stubGlobal('__AUDIO_DEBUG__', [])

    const module = await loadUseSoundModule()
    const sound = module.createSoundController()
    sound.unlockAudio()
    sound.setConsented()
    sound.setVolume(0.5)
    sound.playSceneBgm('top')
    sound.playSceneBgm('judging')
    vi.runAllTimers()

    expect(fadeSpy).toHaveBeenCalledWith(0.5, 0, 500)
    const debugEvents = (globalThis as { __AUDIO_DEBUG__?: unknown[] }).__AUDIO_DEBUG__ ?? []
    expect(debugEvents).toContainEqual({ type: 'bgm', scene: 'judging' })
  })

  it('音声ロード失敗でも例外でアプリが停止しない', async () => {
    // 何を検証するか: 音声ファイル読み込み失敗時に playSe 呼び出しで例外が外へ漏れないこと
    const module = await loadUseSoundModule()
    const sound = module.createSoundController()
    sound.unlockAudio()
    sound.setConsented()
    sound.setVolume(0.5)

    await expect(Promise.resolve().then(() => sound.playSe('se_submit'))).resolves.toBeUndefined()
  })
})
