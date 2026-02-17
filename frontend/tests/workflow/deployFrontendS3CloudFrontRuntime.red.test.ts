import { describe, expect, it } from 'vitest'
import { getWorkflowStep, readWorkflow, workflowExists, type YamlObject } from './helpers/workflowTestUtils'

const STEP_NAMES = {
  syncAssetsToS3: 'Sync assets to S3',
  createCloudFrontInvalidation: 'Create CloudFront invalidation',
  waitCloudFrontInvalidationCompleted: 'Wait CloudFront invalidation completed',
  publishFailureSummary: 'Publish failure summary',
} as const

const loadWorkflowOrFail = (): YamlObject => {
  expect(workflowExists(), '不足ファイル: .github/workflows/deploy-frontend.yml').toBe(true)
  return readWorkflow()
}

describe('E14-02 RED: deploy frontend runtime assumptions (S3/CloudFront)', () => {
  // 何を検証するか: S3_BUCKET_FRONTEND 未設定時に Sync assets to S3 で停止し後続へ進まない設計であること
  it('Sync assets to S3 が S3_BUCKET_FRONTEND を参照し continue-on-error を使わない', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.syncAssetsToS3)
    const run = String(step?.run ?? '')

    expect(run).toContain('$S3_BUCKET_FRONTEND')
    expect(step?.['continue-on-error']).toBeUndefined()
  })

  // 何を検証するか: CLOUDFRONT_DISTRIBUTION_ID 不正時に invalidation関連ステップで停止する設計であること
  it('invalidation関連ステップが CLOUDFRONT_DISTRIBUTION_ID を参照し continue-on-error を使わない', () => {
    const workflow = loadWorkflowOrFail()
    const createStep = getWorkflowStep(workflow, STEP_NAMES.createCloudFrontInvalidation)
    const waitStep = getWorkflowStep(workflow, STEP_NAMES.waitCloudFrontInvalidationCompleted)

    expect(String(createStep?.run ?? '')).toContain('$CLOUDFRONT_DISTRIBUTION_ID')
    expect(String(waitStep?.run ?? '')).toContain('$CLOUDFRONT_DISTRIBUTION_ID')
    expect(createStep?.['continue-on-error']).toBeUndefined()
    expect(waitStep?.['continue-on-error']).toBeUndefined()
  })

  // 何を検証するか: invalidation完了待機が失敗した場合にジョブ全体を失敗扱いにし、失敗サマリーを出力すること
  it('Publish failure summary が failure() 条件で定義される', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.publishFailureSummary)

    expect(step?.if).toBe('failure()')
    expect(String(step?.run ?? '')).toContain('GITHUB_STEP_SUMMARY')
  })
})
