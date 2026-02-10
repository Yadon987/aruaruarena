---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E04-07: TanStack Query / Framer Motion の導入'
labels: 'spec, E04, frontend'
assignees: ''
---

## 📋 概要

フロントエンドの通信基盤とアニメーション基盤を構築する。
TanStack Queryによるサーバーステート管理とキャッシュ戦略、Framer Motionによる画面遷移・UIアニメーションの基盤を整備する。

## 🎯 目的

- **サーバーステート管理の統一**: TanStack Queryで API 通信のキャッシュ・再取得・エラー処理を一元化
- **宣言的なアニメーション**: Framer Motion で画面遷移やモーダル演出を実現
- **開発効率の向上**: 各画面実装（E12-E14）で即座にライブラリを活用できる基盤を提供
- **パフォーマンス最適化**: キャッシュ戦略による不要なAPI呼び出しの削減

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P1（高） |
| 影響範囲 | 新機能（フロントエンド基盤） |
| 想定リリース | Sprint 1 / v0.1.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 3h |
| 前提条件 | E04-06 完了（APIクライアント） |

---

## 📝 詳細仕様

### 機能要件

#### 1. TanStack Query の導入と設定

- `@tanstack/react-query` と `@tanstack/react-query-devtools` のインストール
- `QueryClient` のグローバル設定
  - デフォルトの `staleTime`: 5分（300,000ms）
  - デフォルトの `gcTime`（旧 `cacheTime`）: 10分（600,000ms）
  - デフォルトの `retry`: カスタムロジック（ネットワークエラー時のみ1回）
  - `refetchOnWindowFocus`: false（ポーリングで管理するため）
- `QueryClientProvider` を `App.tsx` に追加
- 開発環境でのみ `ReactQueryDevtools` を表示（二重チェック）

#### 2. カスタムフック基盤（サンプル実装）

| フック名 | 用途 | 使用先Epic |
|----------|------|-----------|
| `useCreatePost` | 投稿作成（Mutation） | E12 |
| `usePost` | 投稿詳細取得（Query） | E13, E14 |
| `useRankings` | ランキング取得（Query + ポーリング） | E12 |
| `useReducedMotion` | Reduced Motion検知 | E12-E14 |

**注**: フックの完全な実装は各Epicで行う。本Issueでは基盤構造のみ。

##### クエリキーの設計

```typescript
// src/shared/constants/queryKeys.ts
export const queryKeys = {
  posts: {
    all: ['posts'] as const,
    detail: (id: string) => [...queryKeys.posts.all, id] as const,
    create: () => [...queryKeys.posts.all, 'create'] as const,
  },
  rankings: {
    all: ['rankings'] as const,
    list: (limit?: number) => [...queryKeys.rankings.all, { limit }] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
```

#### 3. Framer Motion の導入と設定

- `framer-motion` のインストール
- 共通アニメーション設定の定義
  - 画面遷移: フェード（0.5秒）
  - モーダル: フェードイン/アウト + スケール
  - エラーシェイク: 横揺れ
- `AnimatePresence` のラッパーコンポーネント
- Reduced Motion 対応（`useReducedMotion` フック）

##### アニメーション定数

```typescript
// src/shared/constants/animations.ts
export const TRANSITIONS = {
  /** 画面遷移（フルスクリーン切り替え） */
  page: { duration: 0.5, ease: 'easeInOut' },
  /** モーダル表示/非表示 */
  modal: { duration: 0.3, ease: 'easeOut' },
  /** 要素のフェードイン */
  fadeIn: { duration: 0.2, ease: 'easeIn' },
} as const

export const VARIANTS = {
  /** 画面遷移用 */
  page: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  /** モーダル用 */
  modal: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  /** オーバーレイ背景用 */
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
} as const
```

##### Reduced Motion フック

```typescript
// src/shared/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}
```

#### 4. キャッシュ無効化戦略

- **投稿作成成功時**: ランキングキャッシュを無効化（`queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all })`）
- **投稿詳細取得**: キャッシュ優先（`staleTime` 内は再取得しない）
- **ポーリング中**: ランキングは自動更新、投稿詳細は手動無効化なし

#### 5. エラー時の再試行ロジック

```typescript
// カスタム再試行ロジック
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // バリデーションエラーや4xxは再試行しない
        if (error instanceof ApiClientError) {
          if (error.code === 'VALIDATION_ERROR' || error.code === 'RATE_LIMITED') {
            return false
          }
        }
        // ネットワークエラーのみ1回再試行
        return failureCount < 1
      },
    },
  },
})
```

#### 6. ポーリング戦略

- **ランキング**: 3秒間隔で自動更新（`refetchInterval: 3000`）
- **投稿詳細**: 審査中のみ3秒間隔（status === 'judging' 時）
- **エラー時**: ポーリング継続（次回 interval で再試行）
- **連続エラー**: 3回連続エラーでポーリング停止（オプション設定）

### 非機能要件

- **バンドルサイズ**: TanStack Query (~12KB gzipped) + Framer Motion (~30KB gzipped) の追加を許容
- **Tree Shaking**: 未使用の Framer Motion API がバンドルから除外されること
- **アクセシビリティ**: `prefers-reduced-motion` を尊重しアニメーションを無効化可能
- **パフォーマンス**: アニメーションは `transform` と `opacity` のみ使用しハードウェアアクセラレーションを活用
- **メモリ管理**: クエリ上限50個、画面遷移時に不要なクエリを削除

### UI/UX設計

N/A（基盤設定のみ、実際のUI実装はE12-E14で実施）

---

## 🔧 技術仕様

### ディレクトリ構成

```
frontend/src/
├── App.tsx                         # QueryClientProvider / ReactQueryDevtools 追加
├── shared/
│   ├── constants/
│   │   ├── queryKeys.ts            # [NEW] クエリキー定数
│   │   └── animations.ts          # [NEW] アニメーション定数
│   ├── hooks/
│   │   ├── useCreatePost.ts       # [NEW] 投稿作成フック（スケルトン）
│   │   ├── usePost.ts             # [NEW] 投稿取得フック（スケルトン）
│   │   ├── useRankings.ts         # [NEW] ランキング取得フック（スケルトン）
│   │   └── useReducedMotion.ts    # [NEW] Reduced Motion検知フック
│   └── services/
│       └── api.ts                  # 既存（E04-06で実装済み）
```

### パッケージ追加

```bash
npm install @tanstack/react-query@^5.0.0 framer-motion@^11.0.0
npm install -D @tanstack/react-query-devtools@^5.0.0
```

**前提条件**:
- TypeScript: ^5.0.0 以上
- React: ^18.0.0 以上

### QueryClient 設定

```typescript
// App.tsx に追加
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ApiClientError } from '@shared/services'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5分
      gcTime: 10 * 60 * 1000,      // 10分
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError) {
          if (error.code === 'VALIDATION_ERROR' || error.code === 'RATE_LIMITED') {
            return false
          }
        }
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        {/* 既存のルーティングやコンポーネント */}
      </div>
      {import.meta.env.DEV && process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
```

### カスタムフック設計（スケルトン）

```typescript
// hooks/useRankings.ts（スケルトン例）
import { useQuery } from '@tanstack/react-query'
import { api } from '@shared/services'
import { queryKeys } from '@shared/constants/queryKeys'
import type { GetRankingResponse } from '@shared/types'

export function useRankings(limit = 20, options?: { polling?: boolean }) {
  return useQuery<GetRankingResponse>({
    queryKey: queryKeys.rankings.list(limit),
    queryFn: () => api.rankings.list(limit),
    refetchInterval: options?.polling ? 3000 : false,
  })
}
```

```typescript
// hooks/usePost.ts（スケルトン例）
import { useQuery } from '@tanstack/react-query'
import { api } from '@shared/services'
import { queryKeys } from '@shared/constants/queryKeys'
import type { GetPostResponse } from '@shared/types'

export function usePost(id: string) {
  return useQuery<GetPostResponse>({
    queryKey: queryKeys.posts.detail(id),
    queryFn: () => api.posts.get(id),
    enabled: !!id, // idがない場合はクエリを実行しない
    // 審査中のみポーリング（E13で実装）
    // refetchInterval: (data) => data?.status === 'judging' ? 3000 : false,
  })
}
```

```typescript
// hooks/useCreatePost.ts（スケルトン例）
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@shared/services'
import { queryKeys } from '@shared/constants/queryKeys'
import type { CreatePostRequest, CreatePostResponse } from '@shared/types'

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation<CreatePostResponse, Error, CreatePostRequest>({
    mutationFn: (data) => api.posts.create(data),
    onSuccess: () => {
      // ランキングキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all })
    },
  })
}
```

### データモデル (DynamoDB)

N/A（フロントエンド基盤のみ）

### API設計

N/A（E04-06で実装済みのAPIクライアントを利用）

### AIプロンプト設計

N/A

---

## 🧪 テスト計画 (TDD)

### Unit Test

- [ ] 正常系: `queryKeys.posts.detail('id')` が `['posts', 'id']` を返す
- [ ] 正常系: `queryKeys.rankings.list(10)` が `['rankings', { limit: 10 }]` を返す
- [ ] 正常系: `TRANSITIONS.page.duration` が `0.5` である
- [ ] 正常系: `VARIANTS.modal` が `initial`, `animate`, `exit` を含む
- [ ] 正常系: `useRankings` フックが `useQuery` を正しく呼び出す
- [ ] 正常系: `useCreatePost` フックが `useMutation` を正しく呼び出す
- [ ] 正常系: `usePost` フックが投稿IDで `useQuery` を呼び出す
- [ ] 正常系: `useReducedMotion` フックが `prefers-reduced-motion: reduce` を検知する
- [ ] 異常系: `useRankings` で API エラー発生時、`isError` が true になる
- [ ] 異常系: `useRankings` で API エラー発生時、`error` に `ApiClientError` が格納される
- [ ] 異常系: `useCreatePost` で投稿失敗時、`isError` が true になる
- [ ] 境界値: `queryKeys.rankings.list()` が `limit: undefined` でも正しく動作する
- [ ] 境界値: `VARIANTS` の各バリアントに必須プロパティが存在する
- [ ] 境界値: Reduced Motion 有効時、アニメーション duration が 0 になる
- [ ] 境界値: Reduced Motion 無効時、デフォルトの duration が使用される
- [ ] 境界値: `staleTime` 経過後、再取得が実行される
- [ ] 境界値: `gcTime` 経過後、キャッシュが削除される
- [ ] 境界値: 同一クエリの重複呼び出し時、1回のみ API 呼び出しが実行される

### コンポーネントテスト（React Testing Library）

- [ ] 正常系: `QueryClientProvider` が子コンポーネントをレンダリングする
- [ ] 正常系: 開発環境で `ReactQueryDevtools` がレンダリングされる
- [ ] 境界値: 本番環境で `ReactQueryDevtools` がレンダリングされない
- [ ] 境界値: `QueryClient` のデフォルトオプションが正しく設定されている
- [ ] 境界値: Reduced Motion 設定変更時、リアルタイムでアニメーションが無効化される

### 統合テスト（E12-E14で実施）

- [ ] TanStack Queryのキャッシュ戦略が各画面で正しく動作する
- [ ] Framer Motion のアニメーションが画面遷移で正しく動作する
- [ ] ポーリング中のエラー処理が正しく動作する

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** `@tanstack/react-query` がインストールされている
      **When** `App.tsx` をレンダリングする
      **Then** `QueryClientProvider` が正しくマウントされ、子コンポーネントがレンダリングされる

- [ ] **Given** `queryKeys` がインポートされている
      **When** `queryKeys.posts.detail('abc')` を呼び出す
      **Then** `['posts', 'abc']` が返る

- [ ] **Given** `useRankings` フックが呼び出される
      **When** APIクライアント（E04-06）を通じてデータ取得する
      **Then** TanStack Queryのキャッシュに格納され、`staleTime` 内は再取得されない

- [ ] **Given** `framer-motion` がインストールされている
      **When** `VARIANTS.page` を参照する
      **Then** `initial`, `animate`, `exit` プロパティを含むオブジェクトが返る

- [ ] **Given** `TRANSITIONS` がインポートされている
      **When** `TRANSITIONS.modal.duration` を参照する
      **Then** `0.3` が返る

- [ ] **Given** `useReducedMotion` フックが呼び出される
      **When** `prefers-reduced-motion: reduce` が設定されている
      **Then** `true` が返る

### 異常系 (Error Path)

- [ ] **Given** APIクライアントがエラーを返す
      **When** `useRankings` フックが実行される
      **Then** TanStack Queryの `error` ステートに `ApiClientError` が格納される

- [ ] **Given** TanStack Queryの `retry` がカスタムロジックで設定されている
      **When** ネットワークエラーが発生する
      **Then** 1回だけ自動リトライが実行される

- [ ] **Given** TanStack Queryの `retry` がカスタムロジックで設定されている
      **When** バリデーションエラー（VALIDATION_ERROR）が発生する
      **Then** 自動リトライは実行されない

### 境界値 (Edge Case)

- [ ] **Given** 開発環境（`import.meta.env.DEV === true`）
      **When** アプリケーションを起動する
      **Then** `ReactQueryDevtools` が表示される

- [ ] **Given** 本番環境（`import.meta.env.DEV === false`）
      **When** アプリケーションを起動する
      **Then** `ReactQueryDevtools` は含まれない

- [ ] **Given** `prefers-reduced-motion: reduce` が設定されている
      **When** `useReducedMotion` フックを使用する
      **Then** アニメーションの duration が 0 になる

- [ ] **Given** `usePost` フックに空文字の ID が渡される
      **When** フックが実行される
      **Then** API呼び出しは実行されない（`enabled: false`）

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | REDテスト作成（定数・フック） | 45分 |
| Phase 2 | GREEN実装（npm install + 設定ファイル） | 75分 |
| Phase 3 | REFACTOR & ドキュメント | 30分 |
| Phase 4 | コードレビュー対応 | 30分 |
| **合計** | | **3時間** |

### 依存関係

- 前提条件となるIssue: E04-06（APIクライアント基盤）✅ 完了
- 関連するIssue:
  - E12（トップ画面）: `useRankings`, `useCreatePost`, ランキングポーリング
  - E13（審査中画面）: `usePost`, `AnimatePresence`, Framer Motionアニメーション
  - E14（審査結果モーダル）: `usePost`, モーダルアニメーション

---

## 🔗 関連資料

- E04-06 APIクライアント: `src/shared/services/api.ts`
- 画面設計書: `docs/screen_design.md`
- TanStack Query v5: https://tanstack.com/query/latest
- Framer Motion: https://motion.dev/
- Epics一覧: `docs/epics.md`

---

## 📊 Phase 2完了チェック（技術設計確定）

- [ ] AIとの壁打ち設計を完了
- [ ] 設計レビューを実施
- [ ] 全ての不明点を解決
- [ ] このIssueに技術仕様を書き戻し完了

---

**レビュアーへの確認事項:**

- [ ] 仕様の目的が明確か
- [ ] TanStack Queryのデフォルト設定（staleTime、gcTime）は妥当か
- [ ] Framer Motionのアニメーション定数は画面設計書と整合しているか
- [ ] クエリキーの設計は拡張性があるか
- [ ] Reduced Motion 対応の実装方法は適切か
- [ ] エラー時の再試行ロジックは適切か
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] E04-06のAPIクライアントとの連携方針は明確か
- [ ] バンドルサイズへの影響は許容範囲か
- [ ] メモリ管理戦略は適切か
