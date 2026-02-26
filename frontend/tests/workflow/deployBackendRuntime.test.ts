import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

type YamlValue = string | number | boolean | null | YamlObject | YamlValue[]
type YamlObject = Record<string, YamlValue>

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const WORKFLOW_PATH = resolve(MODULE_DIR, '../../../.github/workflows/deploy.yml')

const readWorkflow = (): YamlObject => {
  if (!existsSync(WORKFLOW_PATH)) {
    throw new Error(`不足ファイル: ${WORKFLOW_PATH}`)
  }
  return (load(readFileSync(WORKFLOW_PATH, 'utf-8')) ?? {}) as YamlObject
}

const getSteps = (workflow: YamlObject): YamlObject[] => {
  const jobs = (workflow.jobs ?? {}) as YamlObject
  const deployJob = (jobs.deploy ?? {}) as YamlObject
  const steps = deployJob.steps
  return Array.isArray(steps) ? (steps as YamlObject[]) : []
}

const getStep = (workflow: YamlObject, stepName: string): YamlObject | undefined =>
  getSteps(workflow).find((step) => step.name === stepName)

describe('E19-01: backend deploy workflow runtime assumptions', () => {
  // 何を検証するか: OIDCロール未設定を認証前に明示エラー化して失敗箇所を固定すること
  it('Validate deploy variables が AWS_ROLE_ARN と AWS_REGION を検証する', () => {
    const workflow = readWorkflow()
    const step = getStep(workflow, 'Validate deploy variables')
    expect(step).toBeDefined()

    const env = (step?.env ?? {}) as YamlObject
    const run = String(step?.run ?? '')

    expect(env.AWS_ROLE_ARN).toBe(
      '${{ secrets.AWS_ROLE_ARN || vars.AWS_ROLE_ARN || secrets.AWS_ROLE_ARN_FRONTEND_DEPLOY || vars.AWS_ROLE_ARN_FRONTEND_DEPLOY }}'
    )
    expect(env.AWS_REGION).toBe('${{ env.AWS_REGION }}')
    expect(run).toContain('missing_vars=()')
    expect(run).toContain('AWS_ROLE_ARN')
    expect(run).toContain('AWS_REGION')
    expect(run).toContain('MISSING_DEPLOY_VARS=')
  })

  // 何を検証するか: 認証ステップが secrets/vars フォールバックを参照すること
  it('Configure AWS credentials が role-to-assume を secrets/vars フォールバック参照する', () => {
    const workflow = readWorkflow()
    const step = getStep(workflow, 'Configure AWS credentials (OIDC)')
    expect(step).toBeDefined()

    const withConfig = (step?.with ?? {}) as YamlObject
    expect(withConfig['role-to-assume']).toBe(
      '${{ secrets.AWS_ROLE_ARN || vars.AWS_ROLE_ARN || secrets.AWS_ROLE_ARN_FRONTEND_DEPLOY || vars.AWS_ROLE_ARN_FRONTEND_DEPLOY }}'
    )
    expect(withConfig['aws-region']).toBe('${{ env.AWS_REGION }}')
  })

  // 何を検証するか: 事前検証の後にAWS認証が実行されること
  it('Validate deploy variables の後に Configure AWS credentials が実行される', () => {
    const workflow = readWorkflow()
    const stepNames = getSteps(workflow).map((step) => String(step.name ?? ''))
    const validateIndex = stepNames.indexOf('Validate deploy variables')
    const configureIndex = stepNames.indexOf('Configure AWS credentials (OIDC)')

    expect(validateIndex).toBeGreaterThanOrEqual(0)
    expect(configureIndex).toBeGreaterThanOrEqual(0)
    expect(validateIndex).toBeLessThan(configureIndex)
  })
})
