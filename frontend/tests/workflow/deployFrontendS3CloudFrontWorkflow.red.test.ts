import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_PATH,
  getWorkflowStep,
  getWorkflowSteps,
  readWorkflow,
  workflowExists,
  type YamlObject,
} from './helpers/workflowTestUtils'

const STEP_NAMES = {
  verifyDistDirectory: 'Verify dist directory',
  syncAssetsToS3: 'Sync assets to S3',
  createCloudFrontInvalidation: 'Create CloudFront invalidation',
  waitCloudFrontInvalidationCompleted: 'Wait CloudFront invalidation completed',
  publishFailureSummary: 'Publish failure summary',
  uploadDeployArtifact: 'Upload deploy artifact',
} as const

const loadWorkflowOrFail = (): YamlObject => {
  expect(workflowExists(), `不足ファイル: ${WORKFLOW_PATH}`).toBe(true)
  return readWorkflow()
}

describe('E14-02 RED: deploy-frontend workflow (S3/CloudFront)', () => {
  // 何を検証するか: deploy-frontend.yml が規定パスに存在すること
  it('deploy-frontend.yml が存在する', () => {
    expect(workflowExists(), `不足ファイル: ${WORKFLOW_PATH}`).toBe(true)
  })

  // 何を検証するか: S3同期・invalidation・失敗サマリー・artifact保存の各ステップが定義されていること
  it('E14-02必須ステップが定義される', () => {
    const workflow = loadWorkflowOrFail()
    const stepNames = getWorkflowSteps(workflow).map((step) => String(step.name ?? ''))

    expect(stepNames).toContain(STEP_NAMES.verifyDistDirectory)
    expect(stepNames).toContain(STEP_NAMES.syncAssetsToS3)
    expect(stepNames).toContain(STEP_NAMES.createCloudFrontInvalidation)
    expect(stepNames).toContain(STEP_NAMES.waitCloudFrontInvalidationCompleted)
    expect(stepNames).toContain(STEP_NAMES.publishFailureSummary)
    expect(stepNames).toContain(STEP_NAMES.uploadDeployArtifact)
  })

  // 何を検証するか: aws s3 sync が dist を同期し --delete と --exact-timestamps を指定していること
  it('S3同期コマンドが仕様どおりである', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.syncAssetsToS3)
    const run = String(step?.run ?? '')

    expect(run).toContain('aws s3 sync dist s3://$S3_BUCKET_FRONTEND')
    expect(run).toContain('--delete')
    expect(run).toContain('--exact-timestamps')
  })

  // 何を検証するか: create-invalidation の後に wait invalidation-completed が定義されていること
  it('CloudFront invalidation作成と完了待機が順序どおり定義される', () => {
    const workflow = loadWorkflowOrFail()
    const steps = getWorkflowSteps(workflow)
    const createStep = getWorkflowStep(workflow, STEP_NAMES.createCloudFrontInvalidation)
    const waitStep = getWorkflowStep(workflow, STEP_NAMES.waitCloudFrontInvalidationCompleted)

    expect(String(createStep?.run ?? '')).toContain('aws cloudfront create-invalidation')
    expect(String(createStep?.run ?? '')).toContain("--paths '/*'")
    expect(String(waitStep?.run ?? '')).toContain('aws cloudfront wait invalidation-completed')
    expect(steps.findIndex((step) => step.name === STEP_NAMES.createCloudFrontInvalidation)).toBeLessThan(
      steps.findIndex((step) => step.name === STEP_NAMES.waitCloudFrontInvalidationCompleted),
    )
  })

  // 何を検証するか: Publish failure summary が if: failure() 条件で実行されること
  it('失敗時サマリーステップに if: failure() が設定される', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.publishFailureSummary)

    expect(step).toBeDefined()
    expect(step?.if).toBe('failure()')
  })

  // 何を検証するか: frontend-dist artifact が30日保持で保存されること
  it('artifact保存ステップが frontend-dist / 30日保持を満たす', () => {
    const workflow = loadWorkflowOrFail()
    const step = getWorkflowStep(workflow, STEP_NAMES.uploadDeployArtifact)
    const withConfig = (step?.with ?? {}) as YamlObject

    expect(step?.uses).toBe('actions/upload-artifact@v4')
    expect(withConfig.name).toBe('frontend-dist')
    expect(String(withConfig.path ?? '')).toContain('dist')
    expect(withConfig['retention-days']).toBe(30)
  })
})
