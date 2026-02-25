import { describe, expect, it } from 'vitest'
import {
  REQUIRED_PERMISSIONS,
  REQUIRED_PUSH_PATHS,
  STEP_NAMES,
  WORKFLOW_PATH,
  getWorkflowStep,
  getWorkflowSteps,
  readWorkflow,
  workflowExists,
  type YamlObject,
} from './helpers/workflowTestUtils'

describe('E14-01: deploy-frontend workflow', () => {
  // 何を検証するか: ワークフローファイルが既定パスに存在すること
  it('deploy-frontend.yml が存在する', () => {
    expect(workflowExists(), `不足ファイル: ${WORKFLOW_PATH}`).toBe(true)
  })

  // 何を検証するか: push(main) と workflow_dispatch が定義されること
  it('起動条件が push(main) と workflow_dispatch である', () => {
    const workflow = readWorkflow()
    const triggers = workflow.on as YamlObject
    const push = triggers.push as YamlObject
    const branches = push.branches as string[]

    expect(Array.isArray(branches)).toBe(true)
    expect(branches).toContain('main')
    expect(triggers.workflow_dispatch).toBeDefined()
  })

  // 何を検証するか: 対象パスのみで起動すること（backend変更を含まない）
  it('push.paths は frontend とworkflowファイルのみを対象にする', () => {
    const workflow = readWorkflow()
    const push = ((workflow.on as YamlObject).push ?? {}) as YamlObject
    const paths = push.paths as string[]

    expect(paths).toEqual(Array.from(REQUIRED_PUSH_PATHS))
    expect(paths).not.toContain('backend/**')
  })

  // 何を検証するか: permissions が最小権限の完全一致であること
  it('permissions が id-token と contents の完全一致', () => {
    const workflow = readWorkflow()
    const permissions = workflow.permissions as Record<string, string>

    expect(permissions).toEqual(REQUIRED_PERMISSIONS)
  })

  // 何を検証するか: 実行順序が Setup Node -> Install -> Build の順で固定されること
  it('主要ステップが期待順序で定義される', () => {
    const workflow = readWorkflow()
    const stepNames = getWorkflowSteps(workflow).map((step) => step.name)
    const setupIndex = stepNames.indexOf(STEP_NAMES.setupNode)
    const installIndex = stepNames.indexOf(STEP_NAMES.installDependencies)
    const buildIndex = stepNames.indexOf(STEP_NAMES.buildFrontend)

    expect(setupIndex).toBeGreaterThanOrEqual(0)
    expect(installIndex).toBeGreaterThanOrEqual(0)
    expect(buildIndex).toBeGreaterThanOrEqual(0)
    expect(setupIndex).toBeLessThan(installIndex)
    expect(installIndex).toBeLessThan(buildIndex)
  })

  // 何を検証するか: 必須環境変数チェックで未設定時に早期失敗できること
  it('デプロイ変数の検証ステップが定義される', () => {
    const workflow = readWorkflow()
    const validateStep = getWorkflowStep(workflow, STEP_NAMES.validateDeployVariables)
    expect(validateStep).toBeDefined()
    const runScript = String(validateStep?.run ?? '')

    expect(runScript).toContain('AWS_REGION')
    expect(runScript).toContain('S3_BUCKET_FRONTEND')
    expect(runScript).toContain('CLOUDFRONT_DISTRIBUTION_ID')
    expect(runScript).toContain('missing_vars=()')
    expect(runScript).toContain('MISSING_DEPLOY_VARS=')
  })

  // 何を検証するか: AWS認証確認とデプロイ対象検証のステップが存在すること
  it('事前検証ステップが定義される', () => {
    const workflow = readWorkflow()
    const steps = getWorkflowSteps(workflow)
    const configureStep = getWorkflowStep(workflow, STEP_NAMES.configureAwsCredentials)
    const stsStep = getWorkflowStep(workflow, STEP_NAMES.verifyAwsIdentity)
    const targetStep = getWorkflowStep(workflow, STEP_NAMES.validateDeployTargets)

    expect(configureStep).toBeDefined()
    expect(stsStep).toBeDefined()
    expect(targetStep).toBeDefined()

    const configureIdx = steps.findIndex((step) => step.name === STEP_NAMES.configureAwsCredentials)
    const stsIdx = steps.findIndex((step) => step.name === STEP_NAMES.verifyAwsIdentity)
    const targetIdx = steps.findIndex((step) => step.name === STEP_NAMES.validateDeployTargets)
    expect(configureIdx).toBeGreaterThanOrEqual(0)
    expect(stsIdx).toBeGreaterThanOrEqual(0)
    expect(targetIdx).toBeGreaterThanOrEqual(0)
    expect(configureIdx).toBeLessThan(stsIdx)
    expect(stsIdx).toBeLessThan(targetIdx)
  })
})
