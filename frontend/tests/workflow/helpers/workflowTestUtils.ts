import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

export type YamlValue = string | boolean | null | YamlObject | YamlValue[]
export type YamlObject = Record<string, YamlValue>

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
export const WORKFLOW_PATH = resolve(MODULE_DIR, '../../../../.github/workflows/deploy-frontend.yml')
export const DOC_PATH = resolve(MODULE_DIR, '../../../../docs/deploy/frontend.md')

export const STEP_NAMES = {
  checkout: 'Checkout',
  setupNode: 'Setup Node',
  installDependencies: 'Install dependencies',
  buildFrontend: 'Build frontend',
  configureAwsCredentials: 'Configure AWS credentials',
  deployPlaceholder: 'Deploy placeholder (Issue 2)',
} as const

export const REQUIRED_PERMISSIONS = {
  'id-token': 'write',
  contents: 'read',
} as const

export const REQUIRED_PUSH_PATHS = ['frontend/**', '.github/workflows/deploy-frontend.yml'] as const
export const RESERVED_DOC_KEYS = ['S3_BUCKET_FRONTEND', 'CLOUDFRONT_DISTRIBUTION_ID'] as const
export const REQUIRED_DOC_KEYS = ['AWS_ROLE_ARN_FRONTEND_DEPLOY', 'AWS_REGION'] as const

export const workflowExists = (): boolean => existsSync(WORKFLOW_PATH)
export const docExists = (): boolean => existsSync(DOC_PATH)
export const readDoc = (): string => readFileSync(DOC_PATH, 'utf-8')

export const readWorkflow = (): YamlObject => {
  const content = readFileSync(WORKFLOW_PATH, 'utf-8')
  return (load(content) ?? {}) as YamlObject
}

export const getWorkflowStep = (workflow: YamlObject, stepName: string): YamlObject | undefined => {
  const jobs = workflow.jobs as YamlObject | undefined
  const deployJob = jobs?.['deploy-frontend'] as YamlObject | undefined
  const steps = deployJob?.steps
  if (!Array.isArray(steps)) return undefined
  return (steps as YamlObject[]).find((step) => step.name === stepName)
}

export const getWorkflowSteps = (workflow: YamlObject): YamlObject[] => {
  const jobs = workflow.jobs as YamlObject | undefined
  const deployJob = jobs?.['deploy-frontend'] as YamlObject | undefined
  const steps = deployJob?.steps
  return Array.isArray(steps) ? (steps as YamlObject[]) : []
}
