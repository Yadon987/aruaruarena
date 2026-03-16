import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initializeGoogleAnalytics } from './analytics'

const TEST_MEASUREMENT_ID = 'G-TEST12345'

describe('analytics', () => {
  const originalDataLayer = window.dataLayer
  const originalGtag = window.gtag
  const originalTitle = document.title
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete window.gtag
    window.dataLayer = []
    document.title = 'あるあるアリーナ'
    document.head.querySelector('#ga4-script')?.remove()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    if (originalGtag) {
      window.gtag = originalGtag
    } else {
      delete window.gtag
    }

    if (originalDataLayer) {
      window.dataLayer = originalDataLayer
    } else {
      delete (window as { dataLayer?: unknown[] }).dataLayer
    }
    document.title = originalTitle
    document.head.querySelector('#ga4-script')?.remove()
    warnSpy.mockRestore()
  })

  it('計測IDがnullの場合はGA4スクリプトを初期化しない', () => {
    const measurementId = null
    initializeGoogleAnalytics(measurementId)

    expect(document.head.querySelector('#ga4-script')).toBeNull()
    expect(window.dataLayer).toEqual([])
  })

  it('計測IDがある場合はGA4スクリプトと設定を初期化する', () => {
    initializeGoogleAnalytics(TEST_MEASUREMENT_ID)

    const script = document.head.querySelector<HTMLScriptElement>('#ga4-script')

    expect(script).not.toBeNull()
    expect(script?.src).toContain(
      `https://www.googletagmanager.com/gtag/js?id=${TEST_MEASUREMENT_ID}`
    )
    expect(window.dataLayer).toHaveLength(2)
    expect(window.dataLayer[1]).toEqual(['config', TEST_MEASUREMENT_ID])
  })
})
