import { beforeAll, describe, expect, it } from 'vitest'
import {
  DOC_PATH,
  REQUIRED_IAM_PERMISSIONS,
  REQUIRED_ROLLBACK_DOC_KEYS,
  docExists,
  readDoc,
} from './helpers/workflowTestUtils'

describe('E14-02 RED: deploy frontend docs (S3/CloudFront)', () => {
  beforeAll(() => {
    expect(docExists(), `不足ファイル: ${DOC_PATH}`).toBe(true)
  })

  // 何を検証するか: docs/deploy/frontend.md が存在すること
  it('docs/deploy/frontend.md が存在する', () => {
    expect(docExists(), `不足ファイル: ${DOC_PATH}`).toBe(true)
  })

  // 何を検証するか: rollback_run_id を使ったartifact復元手順が記載されていること
  it('ロールバック手順に rollback_run_id と artifact 復元が記載される', () => {
    const doc = readDoc()

    REQUIRED_ROLLBACK_DOC_KEYS.forEach((key) => {
      expect(doc).toContain(key)
    })
  })

  // 何を検証するか: s3/cloudfront の最小権限一覧が明記されていること
  it('IAM最小権限が記載される', () => {
    const doc = readDoc()

    REQUIRED_IAM_PERMISSIONS.forEach((permission) => {
      expect(doc).toContain(permission)
    })
  })
})
