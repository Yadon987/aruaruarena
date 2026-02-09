import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

// テスト対象のディレクトリ
const srcDir = path.join(__dirname, '..')
const typesDir = path.join(srcDir, 'shared/types')
const constantsDir = path.join(srcDir, 'shared/constants')

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

  describe('正常系: リテラル型の値検証', () => {
    it('JudgePersona が正しいリテラル値を持つ', () => {
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain("'hiroyuki'")
      expect(content).toContain("'dewi'")
      expect(content).toContain("'nakao'")
    })

    it('PostStatus が正しいリテラル値を持つ', () => {
      const content = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      expect(content).toContain("'judging'")
      expect(content).toContain("'scored'")
      expect(content).toContain("'failed'")
    })
  })

  describe('正常系: 定数ファイルの検証', () => {
    it('constants/validation.ts が存在する', () => {
      expect(existsSync(path.join(constantsDir, 'validation.ts'))).toBe(true)
    })

    it('SCORE 定数が定義されている', async () => {
      const { SCORE } = await import('@shared/constants/validation')
      expect(SCORE).toBeDefined()
      expect(SCORE.TOTAL_MAX).toBe(100)
      expect(SCORE.ITEM_MAX).toBe(20)
      expect(SCORE.ITEM_MIN).toBe(0)
      expect(SCORE.ITEMS_COUNT).toBe(5)
    })

    it('TEXT_LENGTH 定数が定義されている', async () => {
      const { TEXT_LENGTH } = await import('@shared/constants/validation')
      expect(TEXT_LENGTH).toBeDefined()
      expect(TEXT_LENGTH.NICKNAME_MIN).toBe(1)
      expect(TEXT_LENGTH.NICKNAME_MAX).toBe(20)
      expect(TEXT_LENGTH.BODY_MIN).toBe(3)
      expect(TEXT_LENGTH.BODY_MAX).toBe(30)
    })

    it('JUDGE 定数が定義されている', async () => {
      const { JUDGE } = await import('@shared/constants/validation')
      expect(JUDGE).toBeDefined()
      expect(JUDGE.COUNT).toBe(3)
      expect(JUDGE.REQUIRED_SUCCESS_COUNT).toBe(2)
      expect(JUDGE.PERSONAS).toEqual(['hiroyuki', 'dewi', 'nakao'])
    })

    it('POST_STATUS 定数が定義されている', async () => {
      const { POST_STATUS } = await import('@shared/constants/validation')
      expect(POST_STATUS).toBeDefined()
      expect(POST_STATUS.VALUES).toEqual(['judging', 'scored', 'failed'])
    })
  })

  describe('正常系: 型の整合性検証', () => {
    it('domain.ts で定数から型を導出している', () => {
      const domainContent = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      // 定数をインポートしていることを確認
      expect(domainContent).toContain('import { JUDGE, POST_STATUS }')
      // 定数から型を導出していることを確認
      expect(domainContent).toContain('typeof JUDGE.PERSONAS[number]')
      expect(domainContent).toContain('typeof POST_STATUS.VALUES[number]')
    })

    it('domain.ts と constants/validation.ts で同じリテラル値を使用している', () => {
      const domainContent = readFileSync(path.join(typesDir, 'domain.ts'), 'utf-8')
      const constantsContent = readFileSync(path.join(constantsDir, 'validation.ts'), 'utf-8')

      // 両方のファイルで同じ審査員ペルソナが使用されていることを確認
      expect(domainContent).toContain("'hiroyuki'")
      expect(constantsContent).toContain("'hiroyuki'")
      expect(domainContent).toContain("'dewi'")
      expect(constantsContent).toContain("'dewi'")
      expect(domainContent).toContain("'nakao'")
      expect(constantsContent).toContain("'nakao'")
    })
  })
})
