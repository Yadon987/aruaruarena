import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSoundController } from '../useSound'

type ExtendedSoundController = ReturnType<typeof createSoundController> & {
  stopBgm?: () => void
  dispose?: () => void
}

function getAudioDebugEvents() {
  return (
    (
      globalThis as {
        __AUDIO_DEBUG__?: Array<{ type: string; scene?: string }>
      }
    ).__AUDIO_DEBUG__ ?? []
  )
}

describe('E18-01 RED: soundController', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.stubGlobal('__AUDIO_DEBUG__', [])
    vi.stubGlobal('__HOWLER_FADE_SPY__', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('setVolume(0)で再生中BGMを停止する', () => {
    // 何を検証するか: 音量0にした瞬間に再生中BGMが停止されること
    const fadeSpy = (globalThis as { __HOWLER_FADE_SPY__?: ReturnType<typeof vi.fn> })
      .__HOWLER_FADE_SPY__!
    const sound = createSoundController()

    sound.unlockAudio()
    sound.setConsented()
    sound.setVolume(0.5)
    sound.playSceneBgm('top')
    fadeSpy.mockClear()

    sound.setVolume(0)
    vi.runAllTimers()

    expect(fadeSpy).not.toHaveBeenCalled()
    sound.playSceneBgm('top')
    expect(getAudioDebugEvents().filter((event) => event.scene === 'top')).toHaveLength(1)
  })

  it('stopBgm()で現在BGMを停止して同一シーンを再生し直せる', () => {
    // 何を検証するか: stopBgm()実行後は同じシーンでも新規再生できること
    const sound = createSoundController() as ExtendedSoundController

    sound.unlockAudio()
    sound.setConsented()
    sound.setVolume(0.5)
    sound.playSceneBgm('top')

    expect(typeof sound.stopBgm).toBe('function')
    expect(sound.stopBgm).toBeDefined()
    if (typeof sound.stopBgm !== 'function') return

    sound.stopBgm()
    sound.playSceneBgm('top')

    const topEvents = getAudioDebugEvents().filter(
      (event) => event.type === 'bgm' && event.scene === 'top'
    )
    expect(topEvents).toHaveLength(2)
  })

  it('dispose()でBGM停止と後始末を行える', () => {
    // 何を検証するか: dispose()でリソース解放用の後始末メソッドを安全に実行できること
    const sound = createSoundController() as ExtendedSoundController

    sound.unlockAudio()
    sound.setConsented()
    sound.setVolume(0.5)
    sound.playSceneBgm('top')

    expect(typeof sound.dispose).toBe('function')
    if (typeof sound.dispose !== 'function') return

    expect(() => sound.dispose()).not.toThrow()
  })
})
