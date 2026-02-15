---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E04-06: APIクライアント(fetch)の基盤実装'
labels: 'spec, E04, frontend'
assignees: ''
---

## 📋 概要

フロントエンドからバックエンドAPIへの通信基盤を構築する。
E04-05で定義した型定義を活用し、型安全なAPIクライアントを実装する。

## 🎯 目的

- **型安全なAPI通信**: E04-05の共通型定義と連携し、リクエスト/レスポンスを型安全に扱う
- **エラーハンドリングの統一**: 全APIで一貫したエラー処理を実現
- **開発効率の向上**: 各機能から簡単に呼び出せるAPIクライアントを提供
- **テスト容易性**: モック可能な設計でTDDを支援

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P1（高） |
| 影響範囲 | 新機能（フロントエンド基盤） |
| 想定リリース | Sprint 1 / v0.1.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 2.5h |
| 前提条件 | E04-05 完了 |

---

## 📝 詳細仕様

### 機能要件

#### 1. APIクライアント基盤 (`src/shared/services/api.ts`)

- `fetch` ベースのラッパー関数を実装（axios不使用でバンドルサイズ軽量化）
- 共通ヘッダー設定（`Content-Type: application/json`）
- ベースURL管理（環境変数 `VITE_API_BASE_URL`、デフォルト `/api`）
- タイムアウト設定（デフォルト10秒、実装時はAbortController使用）
- AbortControllerによるリクエストキャンセル対応
- Credentials設定（`same-origin`）

#### 2. 型付きAPIメソッド

| メソッド | 説明 | リクエスト型 | レスポンス型 |
|---------|------|-------------|-------------|
| `createPost` | 投稿作成 | `CreatePostRequest` | `CreatePostResponse` |
| `getPost` | 投稿取得 | `{ id: string }` | `GetPostResponse` |
| `getRankings` | ランキング取得 | `{ limit?: number }` | `GetRankingResponse` |

**注**: ランキングAPIは `/api/rankings`（複数形）を使用

#### 3. エラーハンドリング

- HTTP 4xx/5xx を `ApiError` 型で統一処理
- JSONパース失敗時はフォールバックエラーメッセージを使用
- ネットワークエラーを専用エラー（`NETWORK_ERROR`）に変換
- タイムアウトエラー（`TIMEOUT`）を識別
- レート制限エラー（429, `RATE_LIMITED`）を識別

### 非機能要件

- **パフォーマンス**: 初回ロード時のバンドルサイズに影響を与えない
- **保守性**: 新規エンドポイント追加が容易な設計
- **テスト容易性**: MSW（E04-09）でモック可能な構造
- **セキュリティ**: same-origin credentials、CORS設定を前提

### UI/UX設計

N/A（APIクライアントのみ）

---

## 🔧 技術仕様

### ディレクトリ構成

```
frontend/src/shared/services/
├── api.ts              # APIクライアント本体
├── api.test.ts         # テスト
└── index.ts            # バレルエクスポート
```

### 環境変数

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api

# .env.production
VITE_API_BASE_URL=/api
```

**バリデーション**:
- 開発環境で未設定時は警告ログを出力
- 未設定時のデフォルト値: `/api`

### コード設計

```typescript
// api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 開発環境でのバリデーション
if (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set, using default: /api')
}

/** APIクライアントエラー */
export class ApiClientError extends Error {
  constructor(
    public message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const timeout = options?.timeout ?? 10000

  // タイムアウト制御
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'same-origin',
      ...options,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 204 No Content のハンドリング
    if (response.status === 204) {
      return {} as T
    }

    if (!response.ok) {
      // JSONパース失敗時のフォールバック
      let errorCode = 'HTTP_ERROR'
      let errorMessage = `HTTP ${response.status} Error`

      try {
        const error: ApiError = await response.json()
        errorCode = error.code
        errorMessage = error.error
      } catch {
        // JSONパース失敗時はデフォルト値を使用
      }

      throw new ApiClientError(errorMessage, errorCode, response.status)
    }

    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    // タイムアウトエラーの識別
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError('Request timeout', 'TIMEOUT', 408)
    }

    // ネットワークエラー
    if (error instanceof TypeError) {
      throw new ApiClientError('Network error', 'NETWORK_ERROR', 0)
    }

    throw error
  }
}

// 型付きAPIメソッド
export const api = {
  posts: {
    create: (data: CreatePostRequest) =>
      request<CreatePostResponse>('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) =>
      request<GetPostResponse>(`/posts/${id}`),
  },
  rankings: {
    list: (limit = 20) =>
      request<GetRankingResponse>(`/rankings?limit=${limit}`),
  },
}

// Note: ApiClientErrorは行118でexport classとしてエクスポート済み
```

### APIエンドポイント仕様

#### 投稿作成: POST /api/posts

| 項目 | 値 |
|------|-----|
| Path | `/api/posts` |
| Request Body | `{ nickname: string, body: string }` |
| Response (成功) | `{ id: string, status: "judging" }` |
| Response (失敗) | `{ error: string, code: string }` |

#### 投稿取得: GET /api/posts/:id

| 項目 | 値 |
|------|-----|
| Path | `/api/posts/:id` |
| Response (judging) | `{ id, nickname, body, status: "judging", created_at }` |
| Response (scored) | `Post` 型（全項目） |
| Response (failed) | `Post` 型（rankはnull） |

**注意**: `judging` 状態では `rank`, `total_count`, `average_score`, `judgments` は返却されない

#### ランキング取得: GET /api/rankings

| 項目 | 値 |
|------|-----|
| Path | `/api/rankings` |
| Query Param | `limit` (オプション, 1-100, デフォルト20) |
| Response | `{ rankings: RankingItem[], total_count: number }` |

---

## 🧪 テスト計画 (TDD)

### Unit Test (api.ts)

- [ ] 正常系: `createPost` が正しくリクエストを送信し、レスポンスを返す
- [ ] 正常系: `getPost` が投稿IDでデータを取得できる
- [ ] 正常系: `getRankings` がランキングデータを取得できる
- [ ] 異常系: HTTPエラー（4xx/5xx）時に `ApiClientError` がスローされる
- [ ] 異常系: ネットワークエラー時に `NETWORK_ERROR` コードのエラーがスローされる
- [ ] 異常系: タイムアウト時に `TIMEOUT` コードのエラーがスローされる
- [ ] 異常系: JSONパース失敗時にフォールバックエラーがスローされる
- [ ] 境界値: 空のレスポンスボディを正しく処理する
- [ ] 境界値: 204 No Content を正しく処理する
- [ ] 型安全性: TypeScript型チェックが正しく機能する

### 統合テスト（MSW使用 - E04-09で実施）

- [ ] MSWハンドラーでモックされたエンドポイントとAPIクライアントの結合テスト
- [ ] ネットワークエラーのシミュレーション
- [ ] レスポンス遅延のシミュレーション
- [ ] 異常なJSONレスポンスのシミュレーション

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** APIクライアントがインポートされている
      **When** `api.posts.create({ nickname: "テスト", body: "あるあるネタ" })` を呼び出す
      **Then** `{ id: "uuid", status: "judging" }` 形式のレスポンスが返る

- [ ] **Given** 有効な投稿IDが存在する
      **When** `api.posts.get("valid-uuid")` を呼び出す
      **Then** `Post` 型のデータが返る

- [ ] **Given** ランキングデータが存在する
      **When** `api.rankings.list()` を呼び出す
      **Then** `{ rankings: [...], total_count: number }` 形式のデータが返る

### 異常系 (Error Path)

- [ ] **Given** バリデーションエラーが発生する入力
      **When** `api.posts.create({ nickname: "", body: "" })` を呼び出す
      **Then** `ApiClientError` がスローされ、`code` に `VALIDATION_ERROR` が含まれる

- [ ] **Given** レート制限に達している
      **When** API呼び出しを行う
      **Then** `ApiClientError` がスローされ、`code` に `RATE_LIMITED` が含まれる

- [ ] **Given** サーバーがダウンしている
      **When** API呼び出しを行う
      **Then** `ApiClientError` がスローされ、`code` に `NETWORK_ERROR` が含まれる

- [ ] **Given** APIレスポンスが10秒以内に返らない
      **When** API呼び出しを行う
      **Then** `ApiClientError` がスローされ、`code` に `TIMEOUT` が含まれる

### 境界値 (Edge Case)

- [ ] **Given** 環境変数 `VITE_API_BASE_URL` が未設定
      **When** APIクライアントを初期化する
      **Then** デフォルト値 `/api` が使用される

- [ ] **Given** APIが204 No Contentを返す
      **When** リクエストを送信する
      **Then** 空オブジェクト `{}` が返る

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | REDテスト作成 | 30分 |
| Phase 2 | GREEN実装（api.ts） | 60分 |
| Phase 3 | REFACTOR & ドキュメント | 30分 |
| Phase 4 | コードレビュー対応 | 30分 |
| **合計** | | **2.5時間** |

### 依存関係

- 前提条件となるIssue: E04-05（共通型定義）✅ 完了
- 関連するIssue: E04-09（MSWの導入）

---

## 🔗 関連資料

- E04-05 共通型定義: `src/shared/types/`
- バックエンドAPI: `docs/epics.md` E05/E07/E08セクション
- Vite環境変数: https://vitejs.dev/guide/env-and-mode.html

---

## 📊 Phase 2完了チェック（技術設計確定）

- [ ] AIとの壁打ち設計を完了
- [ ] 設計レビューを実施
- [ ] 全ての不明点を解決
- [ ] このIssueに技術仕様を書き戻し完了

---

**レビュアーへの確認事項:**

- [ ] 仕様の目的が明確か
- [ ] fetch の選択理由が妥当か（バンドルサイズ軽量化）
- [ ] エラーハンドリング設計は十分か（タイムアウト、ネットワークエラー、JSONパースエラー）
- [ ] セキュリティ考慮は十分か（credentials、CORS）
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] E04-05の型定義と整合しているか
- [ ] バックエンドAPI仕様（E05/E07/E08）と整合しているか
