import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type UseSoundModule = {
  createSoundController: () => {
    isMuted: boolean
    audioUnlocked: boolean
    setMuted: (value: boolean) => void
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

  it('初期値はミュートtrueで開始する', async () => {
    // 何を検証するか: 初回アクセス時に isMuted が true で初期化されること
    const module = await loadUseSoundModule()
    const sound = module.createSoundController()

    expect(sound.isMuted).toBe(true)
    expect(sound.audioUnlocked).toBe(false)
  })

  it('localStorageがfalseならミュート解除状態を復元する', async () => {
    // 何を検証するか: aruaru_sound_muted が false の場合に isMuted=false で復元されること
    localStorage.setItem('aruaru_sound_muted', 'false')

    const module = await loadUseSoundModule()
    const sound = module.createSoundController()

    expect(sound.isMuted).toBe(false)
  })

  it('不正なlocalStorage値はtrueに正規化する', async () => {
    // 何を検証するか: 不正値で起動した場合に true へ正規化して保存し直すこと
    localStorage.setItem('aruaru_sound_muted', 'invalid')

    const module = await loadUseSoundModule()
    module.createSoundController()

    expect(localStorage.getItem('aruaru_sound_muted')).toBe('true')
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
    expect(sound.audioUnlocked).toBe(true)
    sound.setMuted(false)
    sound.playSceneBgm('top')
    sound.playSceneBgm('judging')
    vi.runAllTimers()

    expect(fadeSpy).toHaveBeenCalledWith(1, 0, 500)
    const debugEvents = (globalThis as { __AUDIO_DEBUG__?: unknown[] }).__AUDIO_DEBUG__ ?? []
    expect(debugEvents).toContainEqual({ type: 'bgm', scene: 'judging' })
  })

  it('音声ロード失敗でも例外でアプリが停止しない', async () => {
    // 何を検証するか: 音声ファイル読み込み失敗時に playSe 呼び出しで例外が外へ漏れないこと
    const module = await loadUseSoundModule()
    const sound = module.createSoundController()
    sound.unlockAudio()
    sound.setMuted(false)

    await expect(Promise.resolve().then(() => sound.playSe('se_submit'))).resolves.toBeUndefined()
  })
})
