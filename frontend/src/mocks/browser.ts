import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// workerのみexport。start()はmain.tsx側で呼び出す
export const mswWorker = setupWorker(...handlers)
