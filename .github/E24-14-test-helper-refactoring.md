---
name: テストヘルパー共通化リファクタリング
title: '[SPEC] E24-14 テストヘルパー共通化リファクタリング'
labels: 'refactor, frontend, testing'
---

## 📋 概要

フロントエンドのテストコードにおける重複パターンを抽出し、共通テストヘルパーとして整理する。CodeRabbitレビュー（PR #140）で指摘された改善項目に対応し、DRY原則に従ったテストコードの保守性向上を図る。

## 🎯 目的

- **コード重複の削減**: 13ファイル以上で重複している投稿モーダル操作コードを共通化
- **framer-motionモックの統一**: 6ファイルで重複しているモック定義を一元管理
- **テストコードの可読性向上**: ボイラープレートを削減し、テストの意図を明確化
- **保守性の向上**: UI変更時にヘルパーのみ修正すれば全テストに反映される構造を実現

---

## 📝 詳細仕様

### 機能要件

#### FR-01: framer-motionモックヘルパー

- `frontend/src/test/mocks/framerMotion.ts` を新規作成
- `vi.mock('framer-motion', ...)` の定義を共通化
- **重要制約**: `vi.mock()`はhoistingされるため、モジュールトップレベルで直接記述する必要がある。関数化は不可。
- `motion.div`, `motion.img`, `motion.span`, `motion.button`, `AnimatePresence` の基本的なモック実装を提供
- 動的インポート用のローダー関数をエクスポート

#### FR-02: 投稿モーダル操作ヘルパー

- `frontend/src/test/helpers/postFormHelpers.ts` を新規作成
- 以下の操作をカプセル化したヘルパー関数を提供:
  - `openPostDialog()`: 投稿ボタンクリック → ダイアログ表示待機
  - `fillPostForm(nickname, body)`: ニックネーム・あるある入力
  - `submitPostForm()`: 投稿ボタンクリック
  - `fillAndSubmitPostForm(nickname, body)`: 上記をまとめたヘルパー

#### FR-03: 既存テストファイルの移行

- 重複コードを削除し、共通ヘルパーを使用するように変更
- 影響範囲:
  - framer-motionモック: 6ファイル
  - 投稿モーダル操作: 13ファイル

### 非機能要件

#### NFR-01: 型安全性

- 全てのヘルパー関数にTypeScript型定義を付与
- `any`型の使用を最小限に抑制

#### NFR-02: 後方互換性

- 既存のテストが全てパスすることを保証
- 段階的な移行を可能にするため、ヘルパーは追加のみ（既存パターンを削除しない）

#### NFR-03: パフォーマンス

- ヘルパー導入によるテスト実行時間への影響なし（オーバーヘッド0）

### UI/UX設計

N/A（テストコードの改善タスク）

---

## 🔧 技術仕様

### ディレクトリ構成

```
frontend/src/test/
├── mocks/
│   └── framerMotion.ts        # framer-motionモック（新規）
├── helpers/
│   ├── postFormHelpers.ts     # 投稿フォーム操作ヘルパー（新規）
│   └── index.ts               # ヘルパー統合エクスポート（新規）
├── __tests__/
│   └── postFormHelpers.test.tsx  # ヘルパーのテスト（新規）
├── appTestHelpers.ts          # 既存ヘルパー
└── setup.ts                   # Vitest設定
```

### 新規作成ファイル

#### `frontend/src/test/mocks/framerMotion.ts`

**重要**: `vi.mock()`はhoistingされるため、このファイルはモジュールトップレベルで直接importして使用する。関数化しない。

```typescript
import { vi } from 'vitest'
import type { ReactNode, HTMLAttributes, ImgHTMLAttributes, ButtonHTMLAttributes } from 'react'

/**
 * framer-motionモック
 *
 * 【使用方法】
 * テストファイルのトップレベルで以下のようにimport:
 *
 * import '../../test/mocks/framerMotion'
 *
 * 【注意】
 * vi.mockはhoistingされるため、関数内で呼び出してはいけません。
 * 必ずモジュールトップレベルでimportしてください。
 */
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      <div {...props}>{children}</div>,
    img: ({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) =>
      <img src={src} alt={alt} {...props} />,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }) =>
      <span {...props}>{children}</span>,
    button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) =>
      <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

/**
 * コンポーネントを動的インポートする汎用ローダー
 * テストで使用するコンポーネントを遅延読み込みする際に使用
 *
 * @example
 * const { JudgeSpeechBubble } = await loadComponent(() => import('../JudgeSpeechBubble'))
 */
export async function loadComponent<T>(importFn: () => Promise<T>): Promise<T> {
  return importFn()
}
```

#### `frontend/src/test/helpers/postFormHelpers.ts`

```typescript
import { fireEvent, screen } from '@testing-library/react'

export interface PostFormOptions {
  nickname: string
  body: string
}

/**
 * 投稿モーダルを開く
 * 「投稿する」ボタンをクリックし、ダイアログが表示されるまで待機
 *
 * @returns ダイアログ要素を返すPromise
 *
 * @example
 * const dialog = await openPostDialog()
 */
export async function openPostDialog(): Promise<HTMLElement> {
  // fireEvent.clickは同期的なのでactでラップ不要
  // findByRoleは非同期クエリなので自動的に待機する
  fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
  return screen.findByRole('dialog')
}

/**
 * 投稿フォームに入力する
 *
 * @param options.nickname ニックネーム
 * @param options.body あるある本文
 *
 * @example
 * await fillPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })
 */
export function fillPostForm(options: PostFormOptions): void {
  const { nickname, body } = options
  fireEvent.change(screen.getByLabelText('ニックネーム'), {
    target: { value: nickname },
  })
  fireEvent.change(screen.getByLabelText('あるある'), {
    target: { value: body },
  })
}

/**
 * 投稿フォームを送信する
 * 「投稿」ボタンをクリック
 *
 * @example
 * await submitPostForm()
 */
export function submitPostForm(): void {
  fireEvent.click(screen.getByRole('button', { name: '投稿' }))
}

/**
 * 投稿モーダルを開いて入力・送信まで一括実行
 *
 * @param options.nickname ニックネーム
 * @param options.body あるある本文
 *
 * @example
 * await fillAndSubmitPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })
 */
export async function fillAndSubmitPostForm(options: PostFormOptions): Promise<void> {
  await openPostDialog()
  fillPostForm(options)
  submitPostForm()
}
```

#### `frontend/src/test/helpers/index.ts`

```typescript
export {
  openPostDialog,
  fillPostForm,
  submitPostForm,
  fillAndSubmitPostForm,
  type PostFormOptions,
} from './postFormHelpers'
```

### データモデル (DynamoDB)

N/A（フロントエンドのテスト改善タスク）

### API設計

N/A（フロントエンドのテスト改善タスク）

### AIプロンプト設計

N/A

---

## 🧪 テスト計画 (TDD)

### Unit Test (ヘルパー関数)

#### `frontend/src/test/__tests__/postFormHelpers.test.tsx`

ヘルパー関数のテストは統合テストとして実施（Appコンポーネントが必要なため）

```typescript
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'
import {
  openPostDialog,
  fillPostForm,
  submitPostForm,
  fillAndSubmitPostForm,
} from '../helpers/postFormHelpers'

vi.mock('../../../shared/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/services/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      posts: {
        ...actual.api.posts,
        create: vi.fn(),
      },
    },
  }
})

describe('postFormHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('openPostDialog', () => {
    it('ダイアログを開く', async () => {
      render(<App />)
      const dialog = await openPostDialog()
      expect(dialog).toBeInTheDocument()
    })
  })

  describe('fillPostForm', () => {
    it('フォームに入力する', async () => {
      render(<App />)
      await openPostDialog()
      fillPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })
      expect(screen.getByLabelText('ニックネーム')).toHaveValue('テスト太郎')
      expect(screen.getByLabelText('あるある')).toHaveValue('テスト本文です')
    })

    it('空文字でも入力できる', async () => {
      render(<App />)
      await openPostDialog()
      fillPostForm({ nickname: '', body: '' })
      expect(screen.getByLabelText('ニックネーム')).toHaveValue('')
      expect(screen.getByLabelText('あるある')).toHaveValue('')
    })
  })

  describe('submitPostForm', () => {
    it('投稿ボタンをクリックする', async () => {
      vi.mocked(api.posts.create).mockResolvedValue({ id: 'test', status: 'judging' })
      render(<App />)
      await openPostDialog()
      fillPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })
      submitPostForm()
      await screen.findByTestId('judging-screen')
      expect(api.posts.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('fillAndSubmitPostForm', () => {
    it('一連の操作を実行する', async () => {
      vi.mocked(api.posts.create).mockResolvedValue({ id: 'test', status: 'judging' })
      render(<App />)
      await fillAndSubmitPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })
      await screen.findByTestId('judging-screen')
      expect(api.posts.create).toHaveBeenCalledWith({
        nickname: 'テスト太郎',
        body: 'テスト本文です',
      })
    })
  })

  describe('エラーケース', () => {
    it('投稿ボタンが存在しない場合エラーになる', () => {
      // AppをレンダリングせずにopenPostDialogを呼ぶ
      render(<div>empty</div>)
      expect(() => openPostDialog()).toThrow()
    })
  })
})
```

### 既存テストの回帰テスト

- [ ] 全テストファイル（327テスト）がパスすることを確認
- [ ] Lintエラーが発生しないことを確認
- [ ] ビルドが成功することを確認

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

#### AC-01: framer-motionモックヘルパーの使用

- [ ] **Given** 新規テストファイルを作成する
      **When** `import '../../test/mocks/framerMotion'`を記述してframer-motionコンポーネントを使用するテストを書く
      **Then** モックが適用され、テストが正常に実行される

#### AC-02: 投稿フォームヘルパーの使用

- [ ] **Given** Appコンポーネントをレンダリングした状態で
      **When** `fillAndSubmitPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })`を呼び出す
      **Then** 投稿モーダルが開き、フォームに入力され、送信される

#### AC-03: 既存テストの移行

- [ ] **Given** 移行対象のテストファイル（JudgingPolling.red.test.tsx等）が存在する
      **When** ヘルパーを使用するようにリファクタリングする
      **Then** テストが従来と同じ動作をし、全てパスする

### 異常系 (Error Path)

#### AC-04: 存在しない要素への操作

- [ ] **Given** 投稿ボタンが存在しない状態で
      **When** `openPostDialog()`を呼び出す
      **Then** Testing Libraryのエラーが発生する（期待される動作）

### 境界値 (Edge Case)

#### AC-05: 空入力での操作

- [ ] **Given** 投稿モーダルが開いている状態で
      **When** `fillPostForm({ nickname: '', body: '' })`を呼び出す
      **Then** 空文字が入力される（バリデーションは別途テスト）

---

## 🔗 関連資料

- CodeRabbit Review (PR #140): https://github.com/Yadon987/aruaruarena/pull/140
- Testing Library Best Practices: https://testing-library.com/docs/react-testing-library/intro/
- Vitest Mocking: https://vitest.dev/guide/mocking.html
- Vitest Hoisting: https://vitest.dev/guide/mocking.html#hoisting

---

## 📊 影響範囲

### framer-motionモック移行対象（6ファイル）

| No | ファイル | 優先度 |
|----|---------|--------|
| 1 | `frontend/src/features/judging/components/__tests__/JudgeAvatars.refactor.test.tsx` | 高 |
| 2 | `frontend/src/features/judging/components/__tests__/JudgeAvatars.red.test.tsx` | 高 |
| 3 | `frontend/src/features/judging/components/__tests__/JudgeSpeechBubble.red.test.tsx` | 高 |
| 4 | `frontend/src/features/judging/components/__tests__/JudgeSpeechBubble.refactor.test.tsx` | 高 |
| 5 | `frontend/src/features/top/components/__tests__/PostFormModal.red.test.tsx` | 中 |
| 6 | `frontend/src/features/top/components/__tests__/PostFormModal.refactor.test.tsx` | 中 |

### 投稿モーダル操作移行対象（13ファイル）

| No | ファイル | ヘルパー適用箇所 |
|----|---------|----------------|
| 1 | `frontend/src/features/judging/__tests__/JudgingPolling.red.test.tsx` | 5箇所 |
| 2 | `frontend/src/features/top/__tests__/PostForm.red.test.tsx` | 7箇所 |
| 3 | `frontend/src/features/top/__tests__/topPage.integration.red.test.tsx` | 複数箇所 |
| 4 | `frontend/src/features/judging/__tests__/JudgingScreen.refactor.test.tsx` | 1箇所 |
| 5 | `frontend/src/features/top/__tests__/App.seamless.red.test.tsx` | 1箇所 |
| 6 | `frontend/src/features/judging/__tests__/JudgeAvatarsIntegration.test.tsx` | 1箇所 |
| 7 | `frontend/src/features/judging/__tests__/JudgingPolling.refactor.test.tsx` | 複数箇所 |
| 8 | `frontend/src/features/result/__tests__/ResultModalFlow.red.test.tsx` | 1箇所 |
| 9 | `frontend/src/features/result/components/__tests__/ResultModal.red.test.tsx` | 1箇所 |
| 10 | `frontend/src/features/top/__tests__/bgmScene.red.test.tsx` | 1箇所 |
| 11 | `frontend/src/features/top/__tests__/TopPage.red.test.tsx` | 1箇所 |
| 12 | `frontend/e2e/sound-playback.red.spec.ts` | 1箇所 |
| 13 | `frontend/e2e/top-page-post-form.red.spec.ts` | 1箇所 |

---

## 📅 実装計画

### Phase 1: ヘルパー作成（TDD Red-Green）

1. テストファイル作成: `__tests__/postFormHelpers.test.tsx`
2. ヘルパー実装:
   - `mocks/framerMotion.ts`
   - `helpers/postFormHelpers.ts`
   - `helpers/index.ts`
3. テストがパスすることを確認

**コミット**:
```
test: E24-14 postFormHelpersのテストを追加

- fillPostForm, submitPostForm, fillAndSubmitPostFormのテスト

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

```
feat: E24-14 テストヘルパーを追加

- framerMotion.ts: framer-motionモック
- postFormHelpers.ts: 投稿フォーム操作ヘルパー

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Phase 2: 段階的移行

1. 高優先度ファイル（JudgeAvatars系 4ファイル）を移行
2. テスト実行で回帰がないことを確認
3. 中優先度ファイル（PostFormModal系 2ファイル）を移行
4. 投稿モーダル操作（13ファイル）を移行
5. 全テストパス確認

**コミット**:
```
refactor: E24-14 framer-motionモックを共通化

- JudgeAvatars系テストで共通モックを使用

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

```
refactor: E24-14 投稿フォーム操作を共通ヘルパー化

- 13ファイルでpostFormHelpersを使用

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Phase 3: 検証とクリーンアップ

1. 全テスト実行（`npm run test`）
2. Lint確認（`npm run lint`）
3. ビルド確認（`npm run build`）
4. 不要なコード削除

**コミット**:
```
chore: E24-14 テストヘルパー共通化完了

- 全テストパス確認済み
- Lint・ビルド確認済み

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## ⚠️ 注意事項

### vi.mockのhoisting制約

`vi.mock()`はVitestによってhoisting（巻き上げ）されるため、以下の制約がある：

```typescript
// ❌ 間違い: 関数内で呼び出す
function setupMock() {
  vi.mock('framer-motion', () => ({ ... }))  // 正しく動作しない
}

// ✅ 正しい: モジュールトップレベルでimport
import '../../test/mocks/framerMotion'  // この中でvi.mockが呼ばれる
```

### fireEvent vs userEvent

このヘルパーでは`fireEvent`を使用しているが、よりリアルなユーザー操作をシミュレートする場合は`userEvent`の使用を検討する。ただし、`userEvent`は非同期処理が必要なため、テスト実行時間が増加する可能性がある。

---

**レビュアーへの確認事項:**
- [ ] vi.mockのhoisting制約に対する対応が適切か
- [ ] ヘルパーの関数名・インターフェースが適切か
- [ ] 影響範囲の網羅性（漏れているファイルがないか）
- [ ] 段階的移行のアプローチが適切か
- [ ] テスト計画が正常系/異常系/境界値を網羅しているか
- [ ] fireEventの使用が適切か（userEventとの使い分け）
