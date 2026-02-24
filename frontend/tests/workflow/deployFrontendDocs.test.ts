import { describe, expect, it } from 'vitest'
import { DOC_PATH, REQUIRED_DOC_KEYS, docExists, readDoc } from './helpers/workflowTestUtils'

describe('E14-01: deploy frontend docs', () => {
  // 何を検証するか: デプロイ手順ドキュメントが存在すること
  it('docs/deploy/frontend.md が存在する', () => {
    expect(docExists(), `不足ファイル: ${DOC_PATH}`).toBe(true)
  })

  // 何を検証するか: 本番デプロイ必須値が文書化されること
  it('本番デプロイ必須設定値が記載される', () => {
    const doc = readDoc()
    REQUIRED_DOC_KEYS.forEach((key) => {
      expect(doc).toContain(key)
    })
  })
})
