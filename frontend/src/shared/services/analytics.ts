const GA_SCRIPT_ID = 'ga4-script'
const TOP_PAGE_PATH = '/'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function readMeasurementId(): string | null {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
  return measurementId && measurementId.length > 0 ? measurementId : null
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || []
}

function createGtag() {
  if (typeof window.gtag === 'function') return

  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }
}

function injectGaScript(measurementId: string) {
  if (document.getElementById(GA_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = GA_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
}

export function initializeGoogleAnalytics(measurementId: string | null = readMeasurementId()) {
  if (!measurementId || typeof window === 'undefined' || typeof document === 'undefined') return

  ensureDataLayer()
  createGtag()
  injectGaScript(measurementId)

  window.gtag?.('js', new Date())
  window.gtag?.('config', measurementId, { send_page_view: false })
}

export function trackTopPageView(pathname: string = window.location.pathname) {
  if (pathname !== TOP_PAGE_PATH) return
  if (typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_path: TOP_PAGE_PATH,
    page_title: document.title,
    page_location: window.location.href,
  })
}
