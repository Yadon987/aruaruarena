import { beforeAll, describe, expect, it } from 'vitest'
import {
  DOC_PATH,
  REQUIRED_CONCURRENCY,
  REQUIRED_DOC_KEYS,
  REQUIRED_IAM_PERMISSIONS,
  REQUIRED_PERMISSIONS,
  REQUIRED_ROLLBACK_DOC_KEYS,
  REQUIRED_RUN_URL_FRAGMENT,
  STEP_NAMES,
  WORKFLOW_DISPATCH_INPUT_NAME,
  docExists,
  getWorkflowStep,
  loadWorkflowOrFail,
  readDoc,
  workflowExists,
  type YamlObject,
} from './helpers/workflowTestUtils'

describe('E14-02 Refactor: workflow edge cases', () => {
  beforeAll(() => {
    expect(workflowExists()).toBe(true)
  })

  // 何を検証するか: rollback_run_id の型と必須設定が仕様どおりであること
  it('RF-01 workflow_dispatch.inputs.rollback_run_id が string / required=false で定義される', () => {
    const workflow = loadWorkflowOrFail()
    const dispatch = (workflow.on as YamlObject).workflow_dispatch as YamlObject
    const inputs = (dispatch.inputs ?? {}) as YamlObject
    const rollbackInput = (inputs[WORKFLOW_DISPATCH_INPUT_NAME] ?? {}) as YamlObject

    expect(dispatch).toBeDefined()
    expect(rollbackInput.type).toBe('string')
    expect(rollbackInput.required).toBe(false)
  })

  // 何を検証するか: 同一refで同時実行を抑止する固定設定を維持すること
  it('RF-02 concurrency.group と cancel-in-progress=false を維持する', () => {
    const workflow = loadWorkflowOrFail()
    const concurrency = (workflow.concurrency ?? {}) as YamlObject

    // 厳密比較で意図しない権限/挙動変更を早期検知する。
    expect(concurrency.group).toBe(REQUIRED_CONCURRENCY.group)
    expect(concurrency['cancel-in-progress']).toBe(REQUIRED_CONCURRENCY['cancel-in-progress'])
  })

  // 何を検証するか: permissions を最小権限の完全一致で固定すること
  it('RF-03 permissions が id-token / contents の完全一致である', () => {
    const workflow = loadWorkflowOrFail()
    const permissions = workflow.permissions as Record<string, string>

    // 厳密比較で不要な権限追加を防止する。
    expect(permissions).toEqual(REQUIRED_PERMISSIONS)
  })

  // 何を検証するか: 障害時サマリーが GITHUB_STEP_SUMMARY と run URL を出力すること
  it('RF-04 Publish failure summary が障害導線の最小要件を満たす', () => {
    const workflow = loadWorkflowOrFail()
    const failureSummary = getWorkflowStep(workflow, STEP_NAMES.publishFailureSummary)
    const runScript = String(failureSummary?.run ?? '')

    expect(failureSummary?.if).toBe('failure()')
    expect(runScript).toContain('GITHUB_STEP_SUMMARY')
    expect(runScript).toContain(REQUIRED_RUN_URL_FRAGMENT)
  })
})

describe('E14-02 Refactor: docs consistency', () => {
  beforeAll(() => {
    expect(docExists(), `不足ファイル: ${DOC_PATH}`).toBe(true)
  })

  // 何を検証するか: Issue1必須値を維持しながらIssue2追記を保持していること
  it('RF-05 docs/deploy/frontend.md が必須値と追記内容を保持する', () => {
    const doc = readDoc()

    REQUIRED_DOC_KEYS.forEach((key) => {
      expect(doc, `必須キー "${key}" がドキュメントに存在しません`).toContain(key)
    })
    REQUIRED_ROLLBACK_DOC_KEYS.forEach((key) => {
      expect(doc, `ロールバックキー "${key}" がドキュメントに存在しません`).toContain(key)
    })
    REQUIRED_IAM_PERMISSIONS.forEach((permission) => {
      expect(doc, `IAM権限 "${permission}" がドキュメントに存在しません`).toContain(permission)
    })
  })
})
