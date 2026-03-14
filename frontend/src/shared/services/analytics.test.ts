import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initializeGoogleAnalytics, trackTopPageView } from './analytics'

const TEST_MEASUREMENT_ID = 'G-TEST12345'

describe('analytics', () => {
  const originalDataLayer = window.dataLayer
  const originalGtag = window.gtag
  const originalTitle = document.title

  beforeEach(() => {
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
  })

  it.each([null, undefined])('計測IDが%sの場合はGA4スクリプトを初期化しない', (measurementId) => {
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
    expect(window.dataLayer[1]).toEqual(['config', TEST_MEASUREMENT_ID, { send_page_view: false }])
  })

  it('トップ画面ではpage_viewを送信する', () => {
    initializeGoogleAnalytics(TEST_MEASUREMENT_ID)

    trackTopPageView('/')

    expect(window.dataLayer[2]).toEqual([
      'event',
      'page_view',
      expect.objectContaining({
        page_path: '/',
        page_title: 'あるあるアリーナ',
      }),
    ])
  })

  it('トップ画面以外ではpage_viewを送信しない', () => {
    initializeGoogleAnalytics(TEST_MEASUREMENT_ID)

    trackTopPageView('/judging/test-id')

    expect(window.dataLayer).toHaveLength(2)
  })
})
