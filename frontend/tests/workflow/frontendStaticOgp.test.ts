import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(MODULE_DIR, '../../..')
const INDEX_HTML = resolve(ROOT_DIR, 'frontend/index.html')
const STATIC_OGP_IMAGE = resolve(ROOT_DIR, 'frontend/public/ogp/ogps.webp')

describe('EP36-01: frontend static ogp', () => {
  it('index.html に静的 OGP と Twitter Card が設定されている', () => {
    const indexHtml = readFileSync(INDEX_HTML, 'utf-8')

    expect(indexHtml).toContain('<meta property="og:title" content="あるあるアリーナ" />')
    expect(indexHtml).toContain('<meta property="og:type" content="website" />')
    expect(indexHtml).toContain('<meta property="og:url" content="%VITE_FRONTEND_BASE_URL%/" />')
    expect(indexHtml).toContain('<meta property="og:image" content="%VITE_FRONTEND_BASE_URL%/ogp/ogps.webp" />')
    expect(indexHtml).toContain('<meta property="og:image:type" content="image/webp" />')
    expect(indexHtml).toContain('<meta property="og:image:width" content="1200" />')
    expect(indexHtml).toContain('<meta property="og:image:height" content="630" />')
    expect(indexHtml).toContain('<meta property="og:site_name" content="あるあるアリーナ" />')
    expect(indexHtml).toContain('<meta property="og:locale" content="ja_JP" />')
    expect(indexHtml).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(indexHtml).toContain('<meta name="twitter:image" content="%VITE_FRONTEND_BASE_URL%/ogp/ogps.webp" />')
  })

  it('公開用静的 OGP 画像が frontend/public に存在する', () => {
    expect(existsSync(STATIC_OGP_IMAGE)).toBe(true)
  })
})
