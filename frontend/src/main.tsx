import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

async function enableMocking() {
  if (import.meta.env.DEV) {
    try {
      const { mswWorker } = await import('./mocks/browser')
      await mswWorker.start({ onUnhandledRequest: 'bypass' })
    } catch (error) {
      console.error('MSWの起動に失敗しました:', error)
    }
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})

