import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(MODULE_DIR, '../../..')
const ROOT_README = resolve(ROOT_DIR, 'README.md')
const FRONTEND_ENV_EXAMPLE = resolve(ROOT_DIR, 'frontend/.env.example')
const FRONTEND_README = resolve(ROOT_DIR, 'frontend/README.md')

describe('E14: frontend env consistency', () => {
  it('docs が VITE_API_BASE_URL を使用し旧キーを含まない', () => {
    const rootReadme = readFileSync(ROOT_README, 'utf-8')
    const frontendEnvExample = readFileSync(FRONTEND_ENV_EXAMPLE, 'utf-8')
    const frontendReadme = readFileSync(FRONTEND_README, 'utf-8')

    expect.soft(rootReadme).toContain('VITE_API_BASE_URL')
    expect.soft(rootReadme).toContain('VITE_API_BASE_URL=/api')
    expect.soft(frontendEnvExample).toContain('VITE_API_BASE_URL')
    expect.soft(frontendEnvExample).toContain('VITE_API_BASE_URL=/api')
    expect.soft(frontendReadme).toContain('VITE_API_BASE_URL')
    expect.soft(frontendReadme).toContain('VITE_API_BASE_URL=/api')

    expect.soft(rootReadme).not.toContain('REACT_APP_API_URL')
    expect.soft(rootReadme).not.toContain('REACT_APP_GA_MEASUREMENT_ID')
    expect.soft(frontendEnvExample).not.toContain('VITE_API_URL=')
    expect.soft(frontendReadme).not.toContain('VITE_API_URL=')
  })
})
