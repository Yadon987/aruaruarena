import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'dseg/css/dseg.css'
import App from './App.tsx'
import './index.css'
import { initializeGoogleAnalytics } from './shared/services'

function shouldUseMockApi(): boolean {
  const value = import.meta.env.VITE_USE_MOCK_API
  if (value == null || value.trim() === '') return false

  const normalized = value.toLowerCase().trim()
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes'
}

async function enableMocking() {
  if (import.meta.env.DEV && shouldUseMockApi()) {
    try {
      const { mswWorker } = await import('./mocks/browser')
      await mswWorker.start({ onUnhandledRequest: 'bypass' })
    } catch (error) {
      console.error('MSWの起動に失敗しました:', error)
    }
  }
}

enableMocking().then(() => {
  initializeGoogleAnalytics()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
