import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { expect, afterEach } from 'vitest'

// VitestのグローバルexpectにJest DOMのマッチャーを追加
expect.extend(matchers)

// 各テスト後にDOMをクリーンアップ
afterEach(() => {
  cleanup()
})
