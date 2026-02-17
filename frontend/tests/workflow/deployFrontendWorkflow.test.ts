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

    expect(stepNames).toContain(STEP_NAMES.setupNode)
    expect(stepNames).toContain(STEP_NAMES.installDependencies)
    expect(stepNames).toContain(STEP_NAMES.buildFrontend)
    expect(stepNames.indexOf(STEP_NAMES.setupNode)).toBeLessThan(
      stepNames.indexOf(STEP_NAMES.installDependencies),
    )
    expect(stepNames.indexOf(STEP_NAMES.installDependencies)).toBeLessThan(
      stepNames.indexOf(STEP_NAMES.buildFrontend),
    )
  })

  // 何を検証するか: Deploy placeholder がIssue2向けダミーとして存在すること
  it('Deploy placeholder (Issue 2) が定義される', () => {
    const workflow = readWorkflow()
    const placeholder = getWorkflowStep(workflow, STEP_NAMES.deployPlaceholder)

    expect(placeholder).toBeDefined()
    expect(String(placeholder?.run ?? '')).toContain('TODO')
    expect(String(placeholder?.run ?? '')).toContain('echo')
  })
})
