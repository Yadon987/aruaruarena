#!/bin/bash

# Note: set -eを使用せず、明示的なエラーハンドリングを実装
# すべてのエラーを収集してレポートするため

# プロジェクトルートに移動
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
# 型定義がない状態でのビルドチェックは必ずしも失敗しない（空ファイルは有効なTS）のため、
# ここのチェックは「ビルドが通ること」を確認するものだが、
# 定義欠損の判定で既にFAILURESが増えているはず。
# 明示的にビルド結果をチェックしてエラーを収集します
npm run build > /dev/null 2>&1
BUILD_RESULT=$?
if [ $BUILD_RESULT -eq 0 ]; then
    echo "✅ [OK] ビルド成功"
else
    echo "❌ [NG] ビルド失敗"
    # ビルド失敗もエラーカウントに含める
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
