import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initializeGoogleAnalytics, trackTopPageView } from './analytics'

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

    window.dataLayer = originalDataLayer ?? []
    document.title = originalTitle
    document.head.querySelector('#ga4-script')?.remove()
  })

  it('計測IDがある場合はGA4スクリプトと設定を初期化する', () => {
    initializeGoogleAnalytics('G-D3Y9975R3L')

    const script = document.head.querySelector<HTMLScriptElement>('#ga4-script')

    expect(script).not.toBeNull()
    expect(script?.src).toContain('https://www.googletagmanager.com/gtag/js?id=G-D3Y9975R3L')
    expect(window.dataLayer).toHaveLength(2)
    expect(window.dataLayer[1]).toEqual(['config', 'G-D3Y9975R3L', { send_page_view: false }])
  })

  it('トップ画面ではpage_viewを送信する', () => {
    initializeGoogleAnalytics('G-D3Y9975R3L')

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
    initializeGoogleAnalytics('G-D3Y9975R3L')

    trackTopPageView('/judging/test-id')

    expect(window.dataLayer).toHaveLength(2)
  })
})
