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
    expect(withConfig['role-to-assume']).toBe(
      '${{ secrets.AWS_ROLE_ARN_FRONTEND_DEPLOY || vars.AWS_ROLE_ARN_FRONTEND_DEPLOY }}'
    )
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
    const env = (step?.env ?? {}) as YamlObject
    const run = String(step?.run ?? '')

    expect(env.AWS_ROLE_ARN_FRONTEND_DEPLOY).toBe(
      '${{ secrets.AWS_ROLE_ARN_FRONTEND_DEPLOY || vars.AWS_ROLE_ARN_FRONTEND_DEPLOY }}'
    )
    expect(run).toContain('missing_vars=()')
    expect(run).toContain('AWS_ROLE_ARN_FRONTEND_DEPLOY')
    expect(run).toContain('AWS_REGION')
    expect(run).toContain('S3_BUCKET_FRONTEND')
    expect(run).toContain('CLOUDFRONT_DISTRIBUTION_ID')
    expect(run).toContain('MISSING_DEPLOY_VARS=')
    expect(step?.['continue-on-error']).toBeUndefined()
  })

  // 何を検証するか: AWS認証情報の有効性をデプロイ前に検証すること
  it('Verify AWS identity が sts get-caller-identity を実行する', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.verifyAwsIdentity)
    expect(step).toBeDefined()

    expect(step?.run).toBe('aws sts get-caller-identity --output json')
    expect(step?.['continue-on-error']).toBeUndefined()
  })

  // 何を検証するか: デプロイ対象のS3/CloudFrontを事前検証して早期失敗できること
  it('Validate deploy targets が S3/CloudFront の存在を検証する', () => {
    const workflow = readWorkflow()
    const step = getWorkflowStep(workflow, STEP_NAMES.validateDeployTargets)
    expect(step).toBeDefined()
    const run = String(step?.run ?? '')

    expect(run).toContain('aws s3api head-bucket --bucket "$S3_BUCKET_FRONTEND"')
    expect(run).toContain(
      'aws cloudfront get-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID" --query \'Distribution.Id\' --output text'
    )
    expect(step?.['continue-on-error']).toBeUndefined()
  })
})
