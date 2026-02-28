import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { queryClient } from '../shared/config/queryClient'

const ROOT_PATH = '/'
const SUPPRESSED_ERROR_MESSAGES = Object.freeze([
  '再審査API呼び出しに失敗しました',
])
const originalConsoleError = console.error.bind(console)
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null

// VitestのグローバルexpectにJest DOMのマッチャーを追加
expect.extend(matchers)

beforeEach(() => {
  window.history.replaceState({}, '', ROOT_PATH)

  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message, ...rest) => {
    const normalizedMessage = [message, ...rest]
      .map((value) => (typeof value === 'string' ? value : String(value ?? '')))
      .join(' ')

    if (SUPPRESSED_ERROR_MESSAGES.some((pattern) => normalizedMessage.includes(pattern))) {
      return
    }

    originalConsoleError(message, ...rest)
  })
})

// 各テスト後にDOMをクリーンアップ
afterEach(() => {
  consoleErrorSpy?.mockRestore()
  consoleErrorSpy = null
  queryClient.clear()
  cleanup()
})
