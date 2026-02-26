import { describe, expect, it } from 'vitest'
import { STEP_NAMES, getWorkflowStep, loadWorkflowOrFail } from './helpers/workflowTestUtils'

describe('E14-02 RED: deploy frontend runtime assumptions (S3/CloudFront)', () => {
  // 何を検証するか: デプロイ先設定をジョブenvへ明示しステップ間で一貫参照すること
  it('job env に AWS_REGION, S3_BUCKET_FRONTEND と CLOUDFRONT_DISTRIBUTION_ID を定義する', () => {
    const workflow = loadWorkflowOrFail()
    const jobs = (workflow.jobs ?? {}) as Record<string, unknown>
    const deployJob = (jobs['deploy-frontend'] ?? {}) as Record<string, unknown>
    const env = (deployJob.env ?? {}) as Record<string, string>

    expect(env.AWS_REGION).toBe('${{ vars.AWS_REGION || secrets.AWS_REGION || \'ap-northeast-1\' }}')
    expect(env.S3_BUCKET_FRONTEND).toBe('${{ vars.S3_BUCKET_FRONTEND || secrets.S3_BUCKET_FRONTEND }}')
    expect(env.CLOUDFRONT_DISTRIBUTION_ID).toBe(
      '${{ vars.CLOUDFRONT_DISTRIBUTION_ID || secrets.CLOUDFRONT_DISTRIBUTION_ID }}'
    )
  })

  // 何を検証するか: S3_BUCKET_FRONTEND 未設定時に Sync assets to S3 で停止し後続へ進まない設計であること
  it('Sync assets to S3 が S3_BUCKET_FRONTEND を参照し continue-on-error を使わない', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.syncAssetsToS3)
    expect(step).toBeDefined()
    const run = String(step?.run ?? '')

    expect(run).toContain('$S3_BUCKET_FRONTEND')
    expect(step?.['continue-on-error']).toBeUndefined()
  })

  // 何を検証するか: CLOUDFRONT_DISTRIBUTION_ID 不正時に invalidation関連ステップで停止する設計であること
  it('invalidation関連ステップが CLOUDFRONT_DISTRIBUTION_ID を参照し continue-on-error を使わない', () => {
    const workflow = loadWorkflowOrFail()
    const createStep = getWorkflowStep(workflow, STEP_NAMES.createCloudFrontInvalidation)
    const waitStep = getWorkflowStep(workflow, STEP_NAMES.waitCloudFrontInvalidationCompleted)
    expect(createStep).toBeDefined()
    expect(waitStep).toBeDefined()

    expect(createStep?.id).toBe('create_invalidation')
    expect(String(createStep?.run ?? '')).toContain('$CLOUDFRONT_DISTRIBUTION_ID')
    expect(String(waitStep?.run ?? '')).toContain('$CLOUDFRONT_DISTRIBUTION_ID')
    expect(String(createStep?.run ?? '')).toContain("--query 'Invalidation.Id'")
    expect(String(createStep?.run ?? '')).toContain('GITHUB_OUTPUT')
    expect(String(waitStep?.run ?? '')).toContain('${{ steps.create_invalidation.outputs.id }}')
    expect(createStep?.['continue-on-error']).toBeUndefined()
    expect(waitStep?.['continue-on-error']).toBeUndefined()
  })

  // 何を検証するか: invalidation完了待機が失敗した場合にジョブ全体を失敗扱いにし、失敗サマリーを出力すること
  it('Publish failure summary が failure() 条件で定義される', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.publishFailureSummary)
    expect(step).toBeDefined()

    expect(step?.if).toBe('failure()')
    expect(String(step?.run ?? '')).toContain('GITHUB_STEP_SUMMARY')
    expect(String(step?.run ?? '')).toContain('MISSING_DEPLOY_VARS')
  })

  // 何を検証するか: distのエントリポイントが存在しない場合に同期前で停止すること
  it('Verify dist entrypoint が dist/index.html を検証する', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.verifyDistEntrypoint)
    expect(step).toBeDefined()
    const run = String(step?.run ?? '')

    expect(run).toContain('dist/index.html')
    expect(step?.['working-directory']).toBe('./frontend')
    expect(step?.['continue-on-error']).toBeUndefined()
  })
})
