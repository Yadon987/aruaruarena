const GA_SCRIPT_ID = 'ga4-script'
const GA_MEASUREMENT_META_NAME = 'ga-measurement-id'
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/i
let hasWarnedMissingMeasurementId = false
let hasWarnedInvalidMeasurementId = false

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function readMeasurementId(): string | null {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
  if (measurementId && measurementId.length > 0) return measurementId
  if (typeof document === 'undefined') return null

  const meta = document.querySelector<HTMLMetaElement>(
    `meta[name="${GA_MEASUREMENT_META_NAME}"]`
  )
  const metaValue = meta?.content?.trim()
  if (!metaValue || metaValue.startsWith('%VITE_')) return null
  return metaValue
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

function warnMissingMeasurementId() {
  if (hasWarnedMissingMeasurementId) return
  hasWarnedMissingMeasurementId = true
  console.warn(
    'GA4計測IDが未設定のため、Google Analyticsの計測をスキップしました。VITE_GA_MEASUREMENT_IDを設定してください。'
  )
}

function warnInvalidMeasurementId(measurementId: string) {
  if (hasWarnedInvalidMeasurementId) return
  if (GA_MEASUREMENT_ID_PATTERN.test(measurementId)) return
  hasWarnedInvalidMeasurementId = true
  console.warn(
    `GA4計測IDの形式が想定と異なります: ${measurementId}。G-XXXXXXX 形式の計測IDを確認してください。`
  )
}

export function initializeGoogleAnalytics(measurementId: string | null = readMeasurementId()) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!measurementId) {
    warnMissingMeasurementId()
    return
  }

  warnInvalidMeasurementId(measurementId)
  if (!GA_MEASUREMENT_ID_PATTERN.test(measurementId)) return

  ensureDataLayer()
  createGtag()
  injectGaScript(measurementId)

  window.gtag?.('js', new Date())
  window.gtag?.('config', measurementId)
}
