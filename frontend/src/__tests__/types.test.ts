import { describe, it, expect, expectTypeOf } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// テスト対象のディレクトリ
const srcDir = path.join(__dirname, '..')
const typesDir = path.join(srcDir, 'shared/types')

describe('E04-05: 共通型定義 (Types) の作成', () => {
  describe('正常系: ファイル構成', () => {
    it('domain.ts が存在する', () => {
      const filePath = path.join(typesDir, 'domain.ts')
      expect(existsSync(filePath)).toBe(true)
    })

    it('api.ts が存在する', () => {
      const filePath = path.join(typesDir, 'api.ts')
      expect(existsSync(filePath)).toBe(true)
    })

    it('index.ts が存在する', () => {
      const filePath = path.join(typesDir, 'index.ts')
      expect(existsSync(filePath)).toBe(true)
    })
  })

  // 注意: 以下のテストは型定義が実装されるまでコンパイルエラーになる可能性があります
  // RED状態を確認するために、型定義をインポートしようとします
  // テスト実行時に "Module not found" または "has no exported member" エラーが出ればOKです

  describe('正常系: ドメインモデル型定義', () => {
    it('JudgePersona 型が定義されている', async () => {
      // @ts-ignore - 実装前のため無視
      const { JudgePersona } = await import('@shared/types/domain')
      // 型としてエクスポートされているかはランタイムでは確認しづらいため、
      // 少なくともインポートできるか（undefinedでないか）を確認するわけではない（型は消えるため）
      // しかし、d.ts生成チェックなどをここで行うのは複雑なので、
      // 実際にはTypeScriptのコンパイルチェックに任せる部分が大きい。
      // ここでは、ソースコード内に特定の文字列が含まれているかを簡易チェックする
      
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain('export type JudgePersona')
    })
    
    it('PostStatus 型が定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain('export type PostStatus')
    })

    it('Judgment インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain('export interface Judgment')
    })

    it('Post インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain('export interface Post')
    })

    it('RankingItem インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain('export interface RankingItem')
    })
  })

  describe('正常系: API型定義', () => {
    it('ApiError インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'api.ts'), 'utf-8')
      expect(content).toContain('export interface ApiError')
    })

    it('CreatePostRequest インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'api.ts'), 'utf-8')
      expect(content).toContain('export interface CreatePostRequest')
    })

    it('CreatePostResponse インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'api.ts'), 'utf-8')
      expect(content).toContain('export interface CreatePostResponse')
    })

    it('GetPostResponse 型が定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'api.ts'), 'utf-8')
      expect(content).toContain('export type GetPostResponse')
    })

    it('GetRankingResponse インターフェースが定義されている', () => {
      const content = readFileSync(path.join(typesDir, 'api.ts'), 'utf-8')
      expect(content).toContain('export interface GetRankingResponse')
    })
  })

  describe('正常系: バレルエクスポート', () => {
    it('index.ts から型をエクスポートしている', () => {
      const content = readFileSync(path.join(typesDir, 'index.ts'), 'utf-8')
      expect(content).toContain('export type {')
    })
  })
})
