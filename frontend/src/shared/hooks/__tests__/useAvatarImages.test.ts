import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadUseAvatarImages = async () => {
  const modulePath = '../useAvatarImages'
  return import(modulePath)
}

const createdImages: MockImage[] = []

class MockImage {
  public onload: null | (() => void) = null
  public onerror: null | (() => void) = null
  private imageSrc = ''

  constructor() {
    createdImages.push(this)
  }

  set src(value: string) {
    this.imageSrc = value
  }

  get src() {
    return this.imageSrc
  }
}

describe('E23-01 RED: useAvatarImages', () => {
  beforeEach(() => {
    createdImages.length = 0
    vi.stubGlobal('Image', MockImage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('初期状態から全9枚の画像をプリロードする', async () => {
    // 何を検証するか: 受け入れ基準どおり 3人 x 3表情の9枚を事前読み込みすること
    const { useAvatarImages } = await loadUseAvatarImages()
    const { result } = renderHook(() => useAvatarImages())

    expect(result.current.status).toBe('idle')
    expect(result.current.loadedCount).toBe(0)
    expect(result.current.totalCount).toBe(9)
    expect(createdImages).toHaveLength(9)
  })

  it('全画像の読み込み成功後に loaded になる', async () => {
    // 何を検証するか: すべての画像が onload になったら loaded 状態へ遷移すること
    const { useAvatarImages } = await loadUseAvatarImages()
    const { result } = renderHook(() => useAvatarImages())

    createdImages.forEach((image) => image.onload?.())

    await waitFor(() => {
      expect(result.current.status).toBe('loaded')
      expect(result.current.loadedCount).toBe(9)
    })
  })

  it('1枚でも読み込み失敗したら error になる', async () => {
    // 何を検証するか: 画像読み込み失敗時にクラッシュせず error 状態へ遷移すること
    const { useAvatarImages } = await loadUseAvatarImages()
    const { result } = renderHook(() => useAvatarImages())

    createdImages[0]?.onerror?.()

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})
