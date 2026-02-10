---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E04-09: テスト用モックサーバー（MSW）の導入'
labels: 'spec, E04, frontend, testing'
assignees: ''
---

## 📋 概要

フロントエンドのテスト・開発環境にMSW（Mock Service Worker）を導入する。
バックエンドAPI未実装の段階でもフロントエンド開発を進められるモックサーバー基盤を構築し、
Vitestユニットテスト・Playwright E2Eテスト・ローカル開発の3環境でAPIモックを統一的に使用可能にする。

## 🎯 目的

- **バックエンド非依存の開発**: バックエンドAPI（E05-E08）実装前にフロントエンドUI（E12-E17）を先行開発可能にする
- **テストの安定化**: 外部API依存を排除し、テスト結果を確定的にする
- **モック定義の一元管理**: Vitest / Playwright / 開発サーバーで同じハンドラーを共有し、定義の重複を防ぐ
- **開発体験の向上**: `npm run dev` でモック付きの完全動作するアプリを即座に起動可能にする

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P1（高） |
| 影響範囲 | 新機能（テスト・開発基盤） |
| 想定リリース | Sprint 1 / v0.1.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 2.5h（増加分: 30分） |
| 前提条件 | E04-06 完了（APIクライアント）、E04-08 完了（Playwright） |

---

## 📝 詳細仕様

### 機能要件

#### 1. MSW のインストールと初期設定

- `msw` パッケージのインストール
- Service Worker ファイルの生成（`npx msw init public/ --save`）
- ブラウザ用 / Node.js 用の初期化ファイル作成

#### 2. ディレクトリ構成

```
frontend/
├── src/
│   └── mocks/                        # [NEW] MSWモック定義
│       ├── handlers/                  # [NEW] APIハンドラー
│       │   ├── index.ts              # [NEW] ハンドラー統合エクスポート
│       │   ├── posts.ts              # [NEW] /api/posts ハンドラー
│       │   └── rankings.ts           # [NEW] /api/rankings ハンドラー
│       ├── data/                      # [NEW] モックデータ
│       │   ├── fixtures/             # [NEW] モック用フィクスチャデータ
│       │   │   ├── posts.ts          # [NEW] 投稿フィクスチャ
│       │   │   └── rankings.ts       # [NEW] ランキングフィクスチャ
│       │   └── generators.ts         # [NEW] 動的データ生成関数
│       ├── browser.ts                # [NEW] ブラウザ用MSWセットアップ
│       └── server.ts                 # [NEW] Node.js用MSWセットアップ（Vitest）
├── public/
│   └── mockServiceWorker.js          # [NEW] MSW Service Worker（自動生成）
└── package.json                      # scripts更新
```

#### 3. APIモックハンドラーの実装

既存APIクライアント（`api.ts`）のエンドポイントに対応するハンドラーを作成する。

**対象エンドポイント:**

| メソッド | パス | 説明 | 関連型 |
|---------|------|------|--------|
| `POST` | `/api/posts` | 投稿作成 | `CreatePostRequest` → `CreatePostResponse` |
| `GET` | `/api/posts/:id` | 投稿詳細取得（ポーリング対応） | → `GetPostResponse` |
| `GET` | `/api/rankings` | ランキング取得 | → `GetRankingResponse` |

#### 4. モックデータ（フィクスチャ）の設計

```typescript
// src/mocks/data/fixtures/posts.ts

/** 審査中の投稿 */
export const mockJudgingPost: Post = {
  id: 'mock-uuid-001',
  nickname: 'テスト太郎',
  body: 'スヌーズ押して二度寝',
  status: 'judging' as const,
  created_at: '2026-02-10T00:00:00Z',
}

/** 審査完了の投稿（スコア付き） */
export const mockScoredPost: Post = {
  id: 'mock-uuid-002',
  nickname: 'テスト花子',
  body: '月曜日の朝の電車',
  status: 'scored' as const,
  average_score: 85.3,
  rank: 3,
  total_count: 100,
  created_at: '2026-02-09T12:00:00Z',
  judgments: [
    {
      persona: 'hiroyuki',
      total_score: 82,
      empathy: 14,
      humor: 17,
      brevity: 18,
      originality: 19,
      expression: 14,
      comment: 'それって本当にあるあるですか？',
      success: true,
    },
    {
      persona: 'dewi',
      total_score: 88,
      empathy: 18,
      humor: 16,
      brevity: 17,
      originality: 17,
      expression: 20,
      comment: '素晴らしい表現力ですわ！',
      success: true,
    },
    {
      persona: 'nakao',
      total_score: 86,
      empathy: 20,
      humor: 18,
      brevity: 16,
      originality: 16,
      expression: 16,
      comment: 'うん、わかるよ〜',
      success: true,
    },
  ],
}

/** 審査失敗の投稿 */
export const mockFailedPost: Post = {
  id: 'mock-uuid-003',
  nickname: 'テスト次郎',
  body: 'テスト投稿です',
  status: 'failed' as const,
  created_at: '2026-02-09T11:00:00Z',
  judgments: [
    {
      persona: 'hiroyuki',
      total_score: 20,
      empathy: 5,
      humor: 5,
      brevity: 5,
      originality: 5,
      expression: 0,
      comment: '全然ダメ',
      success: false,
    },
    // 他の審査員も失敗
  ],
}

/** 空のランキングデータ */
export const mockEmptyRankings: GetRankingResponse = {
  rankings: [],
  total_count: 0,
}
```

#### 5. Vitestとの統合

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```typescript
// src/test/setup.ts に追加
import { server } from '../mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

#### 6. ブラウザ（開発環境）との統合

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

```typescript
// src/main.tsx に条件付きで追加
async function enableMocking() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    return worker.start({
      onUnhandledRequest: 'bypass',
    })
  }
}

enableMocking().then(() => {
  // アプリの起動
})
```

#### 7. Playwright E2Eテストとの統合

**アプローチ: Service Worker を有効化する方法を採用**

```typescript
// e2e/fixtures/test-fixtures.ts の拡張
import { test as base } from '@playwright/test'

type MSWFixtures = {
  enableMocking: void
}

export const test = base.extend<MSWFixtures>({
  enableMocking: async ({ page }, use) => {
    // Service Workerを有効化
    await page.addInitScript(() => {
      window.localStorage.setItem('msw-enabled', 'true')
    })
    await use()
  },
})
```

```typescript
// playwright.config.ts の更新
export default defineConfig({
  use: {
    // Service Workerを許可
    serviceWorkers: 'allow',
  },
})
```

#### 8. ポーリングのモック化（NEW）

`judging` → `scored` の状態遷移をシミュレートするハンドラー：

```typescript
// src/mocks/handlers/posts.ts
import { http, HttpResponse } from 'msw'
import { mockJudgingPost, mockScoredPost } from '../data/fixtures/posts'

// リクエスト回数のトラック（簡易実装）
let requestCount = 0

export const postsHandlers = [
  // 投稿詳細取得（ポーリング対応）
  http.get('/api/posts/:id', ({ params }) => {
    const { id } = params

    if (id === 'mock-polling-test') {
      // 3回目のリクエストで judging → scored に遷移
      requestCount++
      if (requestCount < 3) {
        return HttpResponse.json(mockJudgingPost)
      } else {
        return HttpResponse.json(mockScoredPost)
      }
    }

    return HttpResponse.json(mockScoredPost)
  }),
]
```

#### 9. エラーハンドラーの追加（NEW）

```typescript
// src/mocks/handlers/errors.ts
import { http, HttpResponse } from 'msw'

export const errorHandlers = {
  // 404 Not Found
  notFound: http.get('/api/posts/:id', () => {
    return HttpResponse.json(
      { error: '投稿が見つかりません', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }),

  // 400 Validation Error
  validationError: http.post('/api/posts', async ({ request }) => {
    const body = await request.json()
    if (!body.nickname || body.nickname.length === 0) {
      return HttpResponse.json(
        { error: 'ニックネームは必須です', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    return HttpResponse.json(
      { error: '本文は3-30文字で入力してください', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }),

  // 429 Rate Limited
  rateLimited: http.post('/api/posts', () => {
    return HttpResponse.json(
      { error: '投稿頻度を制限中', code: 'RATE_LIMITED' },
      { status: 429 }
    )
  }),

  // ネットワークエラーのシミュレーション
  networkError: http.get('/api/posts/:id', () => {
    // ネットワークエラーをシミュレート
    return HttpResponse.error()
  }),

  // タイムアウトのシミュレーション
  timeout: http.get('/api/posts/:id', async () => {
    // タイムアウトより長い遅延
    await new Promise((resolve) => setTimeout(resolve, 10000))
    return HttpResponse.json({})
  }),
}
```

#### 10. npm scripts の追加・更新

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "VITE_MSW_ENABLED=true vite"
  }
}
```

### 非機能要件

- **実行速度**: MSWのセットアップは500ms以内に完了すること（Performance APIで検証）
- **本番バンドル除外**: MSW関連コードは本番ビルドに含めないこと（`import.meta.env.DEV`でガード）
- **型安全性**: ハンドラーのレスポンスは既存の型定義（`types/api.ts`）に準拠すること
- **拡張性**: E12-E17の実装時に各画面に必要なモックハンドラーを容易に追加できる構成
- **検証手順**:
  - 本番バンドル確認: `npm run build` 後に `vite-bundle-visualizer` でMSWが含まれていないことを確認
  - セットアップ時間計測: `performance.now()` で worker.start() の実行時間を計測

### UI/UX設計

N/A（テスト・開発基盤のみ）

---

## 🔧 技術仕様

### パッケージ追加

```bash
npm install -D msw
npx msw init public/ --save
```

### データモデル (DynamoDB)

N/A（フロントエンド基盤のみ）

### API設計

N/A（既存APIクライアントのモック化）

### AIプロンプト設計

N/A

---

## 🧪 テスト計画 (TDD)

### Unit Test

#### 正常系
- [ ] MSWサーバーが正常に起動し、リクエストをインターセプトする
- [ ] `POST /api/posts` ハンドラーが `CreatePostResponse` を返す
- [ ] `GET /api/posts/:id` ハンドラーが `GetPostResponse` を返す
- [ ] `GET /api/rankings` ハンドラーが `GetRankingResponse` を返す
- [ ] ポーリングハンドラーが `judging` → `scored` に遷移する

#### 異常系
- [ ] 存在しない投稿IDへのリクエストで404エラーを返す
- [ ] バリデーションエラー時に400エラーを返す（空のnickname等）
- [ ] レート制限時に429エラーを返す
- [ ] ネットワークエラーが正しくシミュレートされる
- [ ] タイムアウトが正しくシミュレートされる

#### 境界値
- [ ] ハンドルされていないリクエストで `onUnhandledRequest: 'error'` が発火する
- [ ] 空のランキング（`total_count: 0`）が正しく返る
- [ ] バリデーション境界値: nickname 0文字、21文字、body 2文字、31文字

#### 型安全性（NEW）
- [ ] MSWハンドラーのレスポンスが `types/api.ts` と整合している
- [ ] TypeScriptの型エラーが発生しない

### E2Eテスト（Playwright）

- [ ] モック有効時にトップページがモックデータで表示される
- [ ] 投稿フォーム送信でモックレスポンスが返る
- [ ] ポーリングで状態遷移が正しく表示される

### External Service (WebMock/VCR)

N/A（MSW自体がモックツール）

---

## 📊 Example Mapping（NEW）

| シナリオ | nickname | body | 期待結果 |
|----------|----------|------|----------|
| 正常投稿 | "テスト太郎" | "スヌーズ押して二度寝" | 201, status: "judging" |
| nickname空文字 | "" | "テスト投稿" | 400, VALIDATION_ERROR |
| nickname21文字 | "123456789012345678901" | "テスト投稿" | 400, VALIDATION_ERROR |
| body2文字 | "テスト太郎" | "AB" | 400, VALIDATION_ERROR |
| body31文字 | "テスト太郎" | "1234567890123456789012345678901" | 400, VALIDATION_ERROR |
| 連続投稿（レート制限） | "テスト太郎" | "テスト投稿"（2回目） | 429, RATE_LIMITED |
| 存在しない投稿ID | - | "GET /api/posts/invalid" | 404, NOT_FOUND |
| 空ランキング | - | "GET /api/rankings" | rankings: [], total_count: 0 |
| 全審査員失敗 | - | "特定の投稿ID" | status: "failed" |
| ポーリング遷移 | - | "3回リクエスト" | judging → scored |

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** `msw` がインストールされている
      **When** Vitestテストを実行する
      **Then** MSWがAPIリクエストをインターセプトし、モックレスポンスを返す

- [ ] **Given** モックハンドラーが定義されている
      **When** `POST /api/posts` にリクエストを送信する
      **Then** `{ id: "mock-uuid", status: "judging" }` 形式のレスポンスが返る

- [ ] **Given** モックハンドラーが定義されている
      **When** `GET /api/posts/:id` にリクエストを送信する
      **Then** 投稿詳細（審査結果含む）のモックデータが返る

- [ ] **Given** モックハンドラーが定義されている
      **When** `GET /api/rankings?limit=20` にリクエストを送信する
      **Then** TOP20のランキングモックデータが返る

- [ ] **Given** 開発環境（`import.meta.env.DEV === true`）
      **When** `npm run dev` でViteを起動する
      **Then** ブラウザでMSWが有効化され、APIリクエストがモックされる

- [ ] **Given** ポーリング用ハンドラーが定義されている
      **When** `GET /api/posts/mock-polling-test` を3回リクエストする
      **Then** 1-2回目は `judging`、3回目は `scored` が返る

### 異常系 (Error Path)

- [ ] **Given** 存在しないIDを指定
      **When** `GET /api/posts/invalid-id` にリクエストを送信する
      **Then** `{ error: "投稿が見つかりません", code: "NOT_FOUND" }` が404で返る

- [ ] **Given** バリデーションエラーのリクエスト
      **When** `POST /api/posts` に空のnicknameで送信する
      **Then** `{ error: "...", code: "VALIDATION_ERROR" }` が400で返る

- [ ] **Given** レート制限状態
      **When** 連続してリクエストを送信する
      **Then** `{ error: "投稿頻度を制限中", code: "RATE_LIMITED" }` が429で返る

- [ ] **Given** ネットワークエラーハンドラー
      **When** `server.use(errorHandlers.networkError)` を適用してリクエスト
      **Then** `ApiClientError` がスローされ、`code: "NETWORK_ERROR"` である

- [ ] **Given** タイムアウトハンドラー
      **When** `server.use(errorHandlers.timeout)` を適用してリクエスト
      **Then** `ApiClientError` がスローされ、`code: "TIMEOUT"` である

### 境界値 (Edge Case)

- [ ] **Given** 本番環境（`import.meta.env.DEV === false`）
      **When** アプリをビルドする
      **Then** MSW関連コードがバンドルに含まれない

- [ ] **Given** テスト環境で `onUnhandledRequest: 'error'`
      **When** ハンドルされていないAPIリクエストを送信する
      **Then** テストが失敗し、未定義のリクエストが検出される

- [ ] **Given** `server.resetHandlers()` が呼ばれた後
      **When** 次のテストを実行する
      **Then** ハンドラーの状態がリセットされ、前のテストの影響を受けない

- [ ] **Given** 空のランキングデータ
      **When** `GET /api/rankings` にリクエストする
      **Then** `{ rankings: [], total_count: 0 }` が返る

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | REDテスト作成（モックハンドラーのテスト） | 25分 |
| Phase 2 | GREEN実装（npm install + ハンドラー + セットアップ） | 45分 |
| Phase 3 | Vitest統合 + ブラウザ統合 + エラーハンドラー | 35分 |
| Phase 4 | Playwright統合 | 20分 |
| Phase 5 | REFACTOR & ドキュメント | 20分 |
| Phase 6 | コードレビュー対応 | 15分 |
| **合計** | | **2.5時間** |

### 依存関係

- 前提条件となるIssue:
  - E04-06（APIクライアント）✅ 完了
  - E04-08（Playwright）✅ 完了
- 関連するIssue:
  - E12（トップ画面）: モックデータでUI先行開発
  - E13（審査中画面）: ポーリングのモック
  - E14（審査結果モーダル）: 審査結果モックデータ
  - E15（自分の投稿一覧）: 投稿一覧モックデータ

---

## 🔗 関連資料

- MSW公式ドキュメント: https://mswjs.io/
- MSW + Vitest: https://mswjs.io/docs/integrations/node
- MSW + Playwright: https://mswjs.io/docs/api/setup-server
- 既存APIクライアント: `frontend/src/shared/services/api.ts`
- API型定義: `frontend/src/shared/types/api.ts`
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
- [ ] モックハンドラーが既存APIエンドポイントを網羅しているか
- [ ] Vitest統合の設計は適切か
- [ ] ブラウザ（開発環境）統合の設計は適切か
- [ ] モックデータ（フィクスチャ）は各画面Epicで必要な範囲をカバーしているか
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 本番バンドルからの除外方針は適切か
- [ ] E04-08（Playwright）との連携方針は明確か
- [ ] ポーリングのモック化方針は明確か
- [ ] エラーハンドラー（ネットワーク/タイムアウト）は考慮されているか
- [ ] Example Mappingでシナリオが網羅されているか
