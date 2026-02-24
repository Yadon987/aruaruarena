import { describe, expect, it } from 'vitest'
import { STEP_NAMES, getWorkflowStep, readWorkflow, type YamlObject } from './helpers/workflowTestUtils'

describe('E14-01: deploy frontend runtime assumptions', () => {
  // 何を検証するか: setup-node が frontend/package-lock.json をキャッシュ参照に使用すること
  it('Setup Node は cache-dependency-path に frontend/package-lock.json を指定する', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.setupNode)
    const withConfig = (step?.with ?? {}) as YamlObject

    expect(step?.uses).toBe('actions/setup-node@v4')
    expect(withConfig.cache).toBe('npm')
    expect(withConfig['cache-dependency-path']).toBe('frontend/package-lock.json')
  })

  // 何を検証するか: OIDC設定が secrets/vars を参照し認証失敗位置を固定できること
  it('Configure AWS credentials は必須パラメータを参照する', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.configureAwsCredentials)
    const withConfig = (step?.with ?? {}) as YamlObject

    expect(step?.uses).toBe('aws-actions/configure-aws-credentials@v4')
    expect(withConfig['role-to-assume']).toBe('${{ secrets.AWS_ROLE_ARN_FRONTEND_DEPLOY }}')
    expect(withConfig['aws-region']).toBe('${{ env.AWS_REGION }}')
  })

  // 何を検証するか: npm ci 失敗時に後続へ進まないため continue-on-error を使わないこと
  it('Install dependencies は continue-on-error を設定しない', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.installDependencies)

    expect(step?.['continue-on-error']).toBeUndefined()
    expect(step?.run).toBe('npm ci')
    expect(step?.['working-directory']).toBe('./frontend')
  })

  // 何を検証するか: build失敗時に停止するため continue-on-error を使わないこと
  it('Build frontend は continue-on-error を設定しない', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.buildFrontend)

    expect(step?.['continue-on-error']).toBeUndefined()
    expect(step?.run).toBe('npm run build')
    expect(step?.['working-directory']).toBe('./frontend')
  })

  // 何を検証するか: 必須デプロイ変数が未設定なら以降へ進まないようにすること
  it('Validate deploy variables が必須値を検証する', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.validateDeployVariables)
    expect(step).toBeDefined()
    expect(step?.run).toBeDefined()
    const run = String(step?.run ?? '')

    expect(run).toContain('${AWS_ROLE_ARN_FRONTEND_DEPLOY:?')
    expect(run).toContain('${AWS_REGION:?')
    expect(run).toContain('${S3_BUCKET_FRONTEND:?')
    expect(run).toContain('${CLOUDFRONT_DISTRIBUTION_ID:?')
    expect(step?.['continue-on-error']).toBeUndefined()
  })
})
