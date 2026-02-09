import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
// @ts-ignore
import { useReducedMotion } from '../useReducedMotion'

describe('useReducedMotion', () => {
  let matchMediaMock: any

  beforeEach(() => {
    // matchMedia のモック設定
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    window.matchMedia = matchMediaMock
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('prefers-reduced-motion: reduce が設定されている場合に true を返す', () => {
    // 検証内容: メディアクエリがマッチする場合
    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('prefers-reduced-motion: reduce が設定されていない場合に false を返す', () => {
    // 検証内容: メディアクエリがマッチしない場合
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })
})
