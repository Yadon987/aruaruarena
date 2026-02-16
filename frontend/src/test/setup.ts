import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { expect, afterEach } from 'vitest'
import { queryClient } from '../shared/config/queryClient'

// VitestのグローバルexpectにJest DOMのマッチャーを追加
expect.extend(matchers)

// 各テスト後にDOMをクリーンアップ
afterEach(() => {
  queryClient.clear()
  cleanup()
})
