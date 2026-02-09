---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E04-05: 共通型定義 (Types) の作成'
labels: 'spec, E04, frontend'
assignees: ''
---

## 📋 概要

フロントエンドで使用する共通の型定義を作成し、アプリケーション全体での型安全性と一貫性を確保する。特にバックエンドAPIとのデータ契約となる型定義を整備する。

## 🎯 目的

- **型安全性の確保**: `any` 型の使用を排除し、コンパイル時にエラーを検出する
- **開発効率の向上**: IDEの補完機能を最大限に活用する
- **保守性の向上**: 型定義を一元管理し、変更時の影響範囲を明確にする
- **バックエンドとの整合性**: APIレスポンスの型を定義し、連携ミスを防ぐ

---

## 📊 メタ情報

| 項目 | 値 |
|------|-----|
| 優先度 | P1（高） |
| 影響範囲 | 新機能（フロントエンド基盤） |
| 想定リリース | Sprint 1 / v0.1.0 |
| 担当者 | @username |
| レビュアー | @username |
| 見積もり工数 | 2h |

---

## 📝 詳細仕様

### 機能要件

#### 型定義ファイルの作成

`src/shared/types/` 配下に以下のファイルを作成し、型定義を行う。

1. **`src/shared/types/domain.ts`** (ドメインモデル)
   - `Post` (投稿)
   - `Judgment` (審査結果)
   - `RankingItem` (ランキング項目)
   - `JudgePersona` (審査員ペルソナ: 'hiroyuki' | 'dewi' | 'nakao')
   - `PostStatus` (投稿ステータス: 'judging' | 'scored' | 'failed')

2. **`src/shared/types/api.ts`** (APIレスポンス/リクエスト)
   - `ApiError` (エラーレスポンス)
   - `CreatePostRequest` / `CreatePostResponse`
   - `GetPostResponse`
   - `GetRankingResponse`

3. **`src/shared/types/index.ts`**
   - 上記の型をバレルエクスポートする

### 非機能要件

- **命名規則**: 
  - 型名は PascalCase (例: `User`, `PostData`)
  - インターフェース名の `I` プレフィックスは**禁止** (例: `IPost` ❌ → `Post` ⭕)
- **型安全性**:
  - `any` 型の使用は**厳禁** (必要な場合は `unknown` を使用)
  - `readonly` プロパティを活用し、イミュータブルなデータ構造を推奨
- **ドキュメント**:
  - 複雑な型にはJSDocコメントを付与する
  - スコアの範囲（0-20）、日時のフォーマット（ISO 8601）を明記する

### UI/UX設計

N/A（コードベースの改善のみ）

---

## 🗺️ Example Mapping（ルールと具体例）

| ルール | Given（前提条件） | When（操作） | Then（期待結果） |
|--------|------------------|-------------|-----------------|
| ドメインモデルが定義されている | `domain.ts` が存在する | `import { Post } from '@shared/types'` | `Post` 型が利用可能で、`id`, `body`, `status` 等のプロパティを持つ |
| 審査結果型が定義されている | `domain.ts` が存在する | `import { Judgment } from '@shared/types'` | `empathy`, `humor` 等のスコアプロパティを持ち、JSDocで範囲(0-20)が明記されている |
| APIレスポンス型が定義されている | `api.ts` が存在する | `const res: GetPostResponse` を定義 | `judgments` 配列などのネストされた型も正しく推論される |
| 共通エラー型が定義されている | `api.ts` が存在する | `const error: ApiError` を定義 | `error`, `code` プロパティを持つ |
| ランキング型が定義されている | `api.ts` が存在する | `const ranking: GetRankingResponse` を定義 | `rankings` 配列と `total_count` を持つ |
| バレルエクスポートが機能する | `index.ts` が設定されている | `@shared/types` からインポート | 個別のファイルを指定せずにインポートできる |

---

## 🔧 技術仕様

### データモデル (TypeScript Interface)

#### Domain Models (`domain.ts`)

```typescript
/** 審査員ペルソナ */
export type JudgePersona = 'hiroyuki' | 'dewi' | 'nakao';

/** 投稿ステータス */
export type PostStatus = 'judging' | 'scored' | 'failed';

/**
 * 審査結果
 * 各スコアは0-20の整数値
 */
export interface Judgment {
  persona: JudgePersona;
  /** 合計スコア (0-100) */
  total_score: number;
  /** 共感度 (0-20) */
  empathy: number;
  /** 面白さ (0-20) */
  humor: number;
  /** 簡潔さ (0-20) */
  brevity: number;
  /** 独創性 (0-20) */
  originality: number;
  /** 表現力 (0-20) */
  expression: number;
  /** 審査員コメント */
  comment: string;
  /** 審査成功フラグ */
  success: boolean;
}

/**
 * 投稿データ
 */
export interface Post {
  /** 投稿ID (UUID) */
  id: string;
  /** ニックネーム (1-20文字) */
  nickname: string;
  /** 投稿本文 (3-30文字) */
  body: string;
  /** 投稿ステータス */
  status: PostStatus;
  /** 平均スコア (0-100, 審査完了後に設定) */
  average_score?: number;
  /** ランキング順位 (審査完了後に設定) */
  rank?: number;
  /** 総投稿数 */
  total_count?: number;
  /** 審査結果配列 */
  judgments?: Judgment[];
  /** 作成日時 (ISO 8601形式: 例 2026-02-09T12:00:00Z) */
  created_at: string;
}

/**
 * ランキング項目
 */
export interface RankingItem {
  /** 順位 */
  rank: number;
  /** 投稿ID */
  id: string;
  /** ニックネーム */
  nickname: string;
  /** 投稿本文 */
  body: string;
  /** 平均スコア */
  average_score: number;
}
```

#### API Contracts (`api.ts`)

```typescript
import type { Post, RankingItem, PostStatus } from './domain';

/**
 * 共通エラーレスポンス
 * バックエンドのエラーフォーマットに準拠
 */
export interface ApiError {
  /** エラーメッセージ */
  error: string;
  /** エラーコード (例: RATE_LIMITED, VALIDATION_ERROR) */
  code: string;
}

// ========== 投稿作成 (POST /api/posts) ==========

export interface CreatePostRequest {
  /** ニックネーム (1-20文字) */
  nickname: string;
  /** 投稿本文 (3-30文字) */
  body: string;
}

export interface CreatePostResponse {
  /** 作成された投稿ID */
  id: string;
  /** 初期ステータス (常に 'judging') */
  status: PostStatus;
}

// ========== 投稿取得 (GET /api/posts/:id) ==========

export type GetPostResponse = Post;

// ========== ランキング取得 (GET /api/rankings) ==========

export interface GetRankingResponse {
  /** TOP20のランキング配列 */
  rankings: RankingItem[];
  /** 全投稿数 */
  total_count: number;
}
```

#### Barrel Export (`index.ts`)

```typescript
// Domain Models
export type { JudgePersona, PostStatus, Judgment, Post, RankingItem } from './domain';

// API Types
export type { ApiError, CreatePostRequest, CreatePostResponse, GetPostResponse, GetRankingResponse } from './api';
```

### 後方互換性

- 新規作成のため影響なし

### 移行計画

1. `src/shared/types/` ディレクトリ確認 (E04-04で作成済みのはず)
2. `domain.ts` 作成
3. `api.ts` 作成
4. `index.ts` 作成
5. 型使用テストファイル作成・ビルド確認

---

## 🚫 実装時の禁止事項チェックリスト

- [ ] `any` 型を使用しない (`unknown` または具体的型を使用)
- [ ] インターフェース名に `I` プレフィックスを付けない
- [ ] 1ファイルに大量の型定義を詰め込まない（適切に分割）
- [ ] バックエンドの実際のレスポンスと矛盾する型を定義しない
- [ ] JSDocコメントを省略しない（スコア範囲、日時フォーマットを明記）

---

## 🧪 テスト計画 (TDD)

### 検証スクリプト

`frontend/scripts/verify-e04-05.sh` を作成：

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== E04-05 受入テスト開始 (TDD) ==="
FAILURES=0

check_file() {
  if [ -f "$1" ]; then
    echo "✅ [OK] ファイル存在: $1"
  else
    echo "❌ [NG] ファイル欠損: $1"
    FAILURES=$((FAILURES+1))
  fi
}

check_content() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo "✅ [OK] 定義確認 ($1): $2"
  else
    echo "❌ [NG] 定義欠損 ($1): $2"
    FAILURES=$((FAILURES+1))
  fi
}

echo "--- 1. ファイル存在確認 ---"
check_file "src/shared/types/domain.ts"
check_file "src/shared/types/api.ts"
check_file "src/shared/types/index.ts"

echo "--- 2. ドメインモデル定義確認 ---"
check_content "src/shared/types/domain.ts" "export type JudgePersona"
check_content "src/shared/types/domain.ts" "export type PostStatus"
check_content "src/shared/types/domain.ts" "export interface Judgment"
check_content "src/shared/types/domain.ts" "export interface Post"
check_content "src/shared/types/domain.ts" "export interface RankingItem"

echo "--- 3. API型定義確認 ---"
check_content "src/shared/types/api.ts" "export interface ApiError"
check_content "src/shared/types/api.ts" "export interface CreatePostRequest"
check_content "src/shared/types/api.ts" "export interface CreatePostResponse"
check_content "src/shared/types/api.ts" "export type GetPostResponse"
check_content "src/shared/types/api.ts" "export interface GetRankingResponse"

echo "--- 4. バレルエクスポート確認 ---"
check_content "src/shared/types/index.ts" "export type"

echo "--- 5. ビルドチェック ---"
if npm run build > /dev/null 2>&1; then
  echo "✅ [OK] ビルド成功"
else
  echo "❌ [NG] ビルド失敗"
  FAILURES=$((FAILURES+1))
fi

echo "--- 検証結果 ---"
if [ $FAILURES -eq 0 ]; then
  echo "🎉 すべてのテストに合格しました！ (E04-05 Complete)"
  exit 0
else
  echo "🚨 $FAILURES 個のテストが失敗しました。実装を開始してください。"
  exit 1
fi
```

### 構成確認テスト

- [ ] `src/shared/types/domain.ts` が存在する
- [ ] `src/shared/types/api.ts` が存在する
- [ ] `src/shared/types/index.ts` が存在する

### 型定義確認テスト

- [ ] `JudgePersona`, `PostStatus` 型が定義されている
- [ ] `Judgment`, `Post`, `RankingItem` インターフェースが定義されている
- [ ] `ApiError`, `CreatePostRequest`, `CreatePostResponse`, `GetPostResponse`, `GetRankingResponse` が定義されている

### ビルドチェック

- [ ] `npm run build` (tsc) がエラーなく通る
- [ ] VSCode上で型補完が効くことを確認

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [ ] **Given** E04-04が完了している  
      **When** E04-05の型定義ファイルを作成する  
      **Then** `src/shared/types` 配下に `domain.ts`, `api.ts`, `index.ts` が作成される

- [ ] **Given** 型定義が実装されている  
      **When** 他のコンポーネントで `@shared/types` から `Post` や `CreatePostRequest` をインポートする  
      **Then** 型定義が正しく読み込まれ、プロパティの補完が効く

- [ ] **Given** 型定義が実装されている  
      **When** `post.status` にアクセスする  
      **Then** `'judging' | 'scored' | 'failed'` の型推論が効く

### 異常系 (Error Path)

- [ ] **Given** 定義されていないプロパティにアクセスする  
      **When** `post.unknownProp` のようなコードを書く  
      **Then** TypeScriptのコンパイルエラーが発生する

- [ ] **Given** 型定義に矛盾する値を代入する  
      **When** `const status: PostStatus = 'invalid'` のようなコードを書く  
      **Then** TypeScriptのコンパイルエラーが発生する

---

## 🚀 リリース計画

### フェーズ

| Phase | 作業内容 | 見積もり |
|-------|----------|----------|
| Phase 1 | 型定義ファイルの作成 | 1h |
| Phase 2 | 動作確認 (TSC) | 0.5h |
| Phase 3 | ドキュメント/Wiki更新 | 0.5h |
| **合計** | | **2時間** |

### 依存関係

- 前提条件: #E04-04（ディレクトリ構成の整備）
- 関連: #E05（投稿API）、#E07（投稿詳細API）、#E08（ランキングAPI）

---

## 🔗 関連資料

- `docs/epics.md` - API仕様の参照元
- `docs/db_schema.md` - データモデルの参照元

---

## 📊 Phase 2完了チェック（技術設計確定）

- [x] AIとの壁打ち設計を完了
- [x] 設計レビューを実施
- [x] 全ての不明点を解決
- [x] このIssueに技術仕様を書き戻し完了

---

**レビュアーへの確認事項:**
- [ ] 型定義はAPI仕様（E05, E07, E08）と整合しているか
- [ ] `Post` に `status` プロパティが含まれているか
- [ ] JSDocコメントでスコア範囲(0-20)と日時フォーマット(ISO 8601)が明記されているか
- [ ] 命名規則はプロジェクト標準に従っているか
- [ ] ディレクトリ配置はE04-04の構成に従っているか
