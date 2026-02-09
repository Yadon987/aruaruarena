#!/bin/bash

# E04-04: ディレクトリ構成とパスエイリアスの検証スクリプト
# Issue #13 の受入基準（AC）を検証する
# 実行方法: ./scripts/verify-e04-04.sh

# スクリプトのディレクトリの親（frontendルート）に移動
cd "$(dirname "$0")/.."

# エラー発生時に即終了しない（全項目チェックのため）
set +e

echo "=== E04-04 受入テスト開始 (TDD) ==="
FAILURES=0

# ディレクトリ存在チェック関数
check_dir() {
  if [ -d "$1" ]; then
    echo "✅ [OK] ディレクトリ存在: $1"
  else
    echo "❌ [NG] ディレクトリ欠損: $1"
    FAILURES=$((FAILURES+1))
  fi
}

# ファイル設定チェック関数
check_config() {
  local file="$1"
  local pattern="$2"
  
  if [ ! -f "$file" ]; then
    echo "❌ [NG] ファイル欠損: $file"
    FAILURES=$((FAILURES+1))
    return
  fi

  if grep -q "$pattern" "$file"; then
    echo "✅ [OK] 設定確認 ($file): $pattern"
  else
    echo "❌ [NG] 設定欠損 ($file): $pattern"
    FAILURES=$((FAILURES+1))
  fi
}

echo "--- 1. ディレクトリ構成の検証 (Feature-based Architecture) ---"
# AC: features/ と shared/ ディレクトリが作成されている
check_dir "src/features"
check_dir "src/shared"

# AC: 必要なサブディレクトリが含まれている
check_dir "src/shared/components"
check_dir "src/shared/hooks"
check_dir "src/shared/utils"
check_dir "src/shared/types"
check_dir "src/shared/assets"
check_dir "src/shared/constants"

# AC: グローバルスタイルとルーティング
check_dir "src/styles"
check_dir "src/routes"

echo "--- 2. 設定ファイルの検証 (Path Alias & ESLint) ---"
# AC: パスエイリアスが設定されている (tsconfig.json)
check_config "tsconfig.json" "\"@features/.*\""
check_config "tsconfig.json" "\"@shared/.*\""

# AC: パスエイリアスが設定されている (vite.config.ts)
# シンプルな文字列マッチングを行う
check_config "vite.config.ts" "@features"
check_config "vite.config.ts" "@shared"

# AC: ESLint設定 (Circular Dependency & Resolver)
check_config ".eslintrc.cjs" "import/resolver"
check_config ".eslintrc.cjs" "import/no-cycle"

echo "--- 検証結果 ---"
if [ $FAILURES -eq 0 ]; then
  echo "🎉 すべてのテストに合格しました！ (E04-04 Complete)"
  exit 0
else
  echo "🚨 $FAILURES 個のテストが失敗しました。実装を開始してください。"
  exit 1
fi
