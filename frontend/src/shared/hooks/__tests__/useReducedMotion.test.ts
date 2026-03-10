import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from '../useReducedMotion'

type MediaQueryListMock = MediaQueryList & {
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
}

describe('useReducedMotion', () => {
  let mediaQueryListMock: MediaQueryListMock
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    // MediaQueryList のモックを作成
    mediaQueryListMock = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }

    // window.matchMedia のモック設定
    window.matchMedia = vi.fn().mockReturnValue(mediaQueryListMock)
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it('prefers-reduced-motion: reduce が設定されている場合に true を返す', () => {
    // 検証内容: メディアクエリがマッチする場合
    mediaQueryListMock.matches = true

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('prefers-reduced-motion: reduce が設定されていない場合に false を返す', () => {
    // 検証内容: メディアクエリがマッチしない場合
    mediaQueryListMock.matches = false

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('マウント時に addEventListener が呼ばれる', () => {
    // 検証内容: イベントリスナーの登録
    renderHook(() => useReducedMotion())

    expect(mediaQueryListMock.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('アンマウント時に removeEventListener が呼ばれる', () => {
    // 検証内容: イベントリスナーの解除（メモリリーク防止）
    const { unmount } = renderHook(() => useReducedMotion())
    unmount()

    expect(mediaQueryListMock.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    )
  })
})
