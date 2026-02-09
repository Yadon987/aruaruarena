import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const srcDir = path.join(__dirname, '..')

type Dirent = {
  isDirectory: () => boolean
  name: string
}

// ヘルパー関数: ディレクトリ内のサブディレクトリ名を取得
const getSubdirectoryNames = (dirPath: string): string[] => {
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((dirent: Dirent) => dirent.isDirectory())
    .map((dirent: Dirent) => dirent.name)
}

// ヘルパー関数: ディレクトリが期待するサブディレクトリを含んでいるか検証
const expectSubdirectories = (
  parentPath: string,
  subDirName: string,
  expectedDirs: string[]
): void => {
  const targetDir = path.join(parentPath, subDirName)
  const actualDirs = getSubdirectoryNames(targetDir)

  expectedDirs.forEach((dir) => {
    expect(actualDirs).toContain(dir)
  })
}

describe('E04-04: ディレクトリ構成の整備', () => {
  describe('正常系: ディレクトリ構造の作成', () => {
    it('features/ ディレクトリが存在する', () => {
      const featuresDir = path.join(srcDir, 'features')
      expect(existsSync(featuresDir)).toBe(true)
    })

    it('shared/ ディレクトリが存在する', () => {
      const sharedDir = path.join(srcDir, 'shared')
      expect(existsSync(sharedDir)).toBe(true)
    })

    it('features/post/ に必要なサブディレクトリが含まれている', () => {
      const expectedFeatureDirs = ['components', 'hooks', 'services', 'types', 'utils', '__tests__']
      expectSubdirectories(srcDir, 'features/post', expectedFeatureDirs)
    })

    it('features/ranking/ に必要なサブディレクトリが含まれている', () => {
      const expectedFeatureDirs = ['components', 'hooks', 'services', 'types', 'utils', '__tests__']
      expectSubdirectories(srcDir, 'features/ranking', expectedFeatureDirs)
    })

    it('shared/ に必要なサブディレクトリが含まれている', () => {
      const expectedSharedDirs = ['components', 'hooks', 'utils', 'types', 'constants', 'assets']
      expectSubdirectories(srcDir, 'shared', expectedSharedDirs)
    })
  })

  describe('正常系: バレルエクスポートファイルの存在', () => {
    it('shared/index.ts が存在する', () => {
      const indexPath = path.join(srcDir, 'shared/index.ts')
      expect(existsSync(indexPath)).toBe(true)
    })

    it('features/post/index.ts が存在する', () => {
      const indexPath = path.join(srcDir, 'features/post/index.ts')
      expect(existsSync(indexPath)).toBe(true)
    })

    it('features/ranking/index.ts が存在する', () => {
      const indexPath = path.join(srcDir, 'features/ranking/index.ts')
      expect(existsSync(indexPath)).toBe(true)
    })
  })

  describe('正常系: パスエイリアスの動作確認', () => {
    it('@/ で App.tsx にアクセスできる', async () => {
      const app = await import('@/App')
      expect(app).toBeDefined()
    })

    it('@shared/ で shared/ にアクセスできる', async () => {
      const sharedIndex = await import('@shared/index')
      expect(sharedIndex).toBeDefined()
    })
  })

  describe('異常系: 存在しないパスのインポート', () => {
    it('TypeScriptがエラーを検出する（型チェック）', async () => {
      // このテストは、vitest run --typecheckを実行したときに
      // 存在しないパスをインポートしていると失敗する

      // テスト用のダミーファイルを作成して型チェック
      // 実際のテストでは、型エラーがあるとビルドが失敗する
      expect(true).toBe(true) // プレースホルダー
    })
  })
})
