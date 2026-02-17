import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

export type YamlValue = string | number | boolean | null | YamlObject | YamlValue[]
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
  verifyDistDirectory: 'Verify dist directory',
  syncAssetsToS3: 'Sync assets to S3',
  createCloudFrontInvalidation: 'Create CloudFront invalidation',
  waitCloudFrontInvalidationCompleted: 'Wait CloudFront invalidation completed',
  publishFailureSummary: 'Publish failure summary',
  uploadDeployArtifact: 'Upload deploy artifact',
} as const

export const REQUIRED_PERMISSIONS = {
  'id-token': 'write',
  contents: 'read',
} as const

export const REQUIRED_PUSH_PATHS = ['frontend/**', '.github/workflows/deploy-frontend.yml'] as const
export const RESERVED_DOC_KEYS = ['S3_BUCKET_FRONTEND', 'CLOUDFRONT_DISTRIBUTION_ID'] as const
export const REQUIRED_DOC_KEYS = ['AWS_ROLE_ARN_FRONTEND_DEPLOY', 'AWS_REGION'] as const
export const REQUIRED_IAM_PERMISSIONS = [
  's3:ListBucket',
  's3:PutObject',
  's3:DeleteObject',
  'cloudfront:CreateInvalidation',
  'cloudfront:GetInvalidation',
] as const
export const REQUIRED_ROLLBACK_DOC_KEYS = [
  'rollback_run_id',
  'frontend-dist',
  'aws s3 sync',
  'aws cloudfront create-invalidation',
] as const

export const WORKFLOW_DISPATCH_INPUT_NAME = 'rollback_run_id' as const
export const REQUIRED_CONCURRENCY = {
  group: 'deploy-frontend-${{ github.ref }}',
  'cancel-in-progress': false,
} as const
export const REQUIRED_RUN_URL_FRAGMENT = 'actions/runs/' as const

export const workflowExists = (): boolean => existsSync(WORKFLOW_PATH)
export const docExists = (): boolean => existsSync(DOC_PATH)
export const readDoc = (): string => readFileSync(DOC_PATH, 'utf-8')

export const readWorkflow = (): YamlObject => {
  if (!workflowExists()) {
    throw new Error(`不足ファイル: ${WORKFLOW_PATH}`)
  }
  const content = readFileSync(WORKFLOW_PATH, 'utf-8')
  return (load(content) ?? {}) as YamlObject
}

export const loadWorkflowOrFail = (): YamlObject => readWorkflow()

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
