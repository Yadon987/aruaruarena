#!/bin/bash
set -e

# ==========================================
# プロジェクト完全バックアップスクリプト
# ------------------------------------------
# 目的: DBダンプ、環境変数、機密キー、アップロードファイルを
#       一括でバックアップし、プロジェクト外の安全な場所に保存する。
# ==========================================

# プロジェクトルートディレクトリに移動
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)
PROJECT_NAME=$(basename "$PROJECT_ROOT")
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 保存先ディレクトリ (WSL上のホームディレクトリ直下推奨)
BACKUP_DIR=~/Backup_all
mkdir -p "$BACKUP_DIR"

# 一時作業ディレクトリ作成
TEMP_DIR="/tmp/full_backup_${PROJECT_NAME}_${TIMESTAMP}"
mkdir -p "$TEMP_DIR"

echo "🚀 バックアップを開始します..."
echo "   プロジェクト: $PROJECT_NAME"
echo "   保存先: $BACKUP_DIR"

# ==========================================
# 1. データベースバックアップ (PostgreSQL)
# ==========================================
echo "📦 [1/4] データベースのバックアップを取得中..."

# 環境変数の読み込み (.env.backupがあれば優先、なければ.env)
if [ -f .env.backup ]; then
  source .env.backup
elif [ -f .env ]; then
  source .env
fi

if [ -n "$DATABASE_URL" ]; then
  # pg_dump実行
  # --no-owner --no-acl: リストア時の権限エラー防止
  docker run --rm postgres:17-alpine pg_dump "$DATABASE_URL" --no-owner --no-acl > "$TEMP_DIR/database_dump.sql"
  echo "   ✅ DBダンプ完了: database_dump.sql"
else
  echo "   ⚠️ DATABASE_URLが見つかりません。DBバックアップをスキップします。"
fi

# ==========================================
# 2. 機密ファイル・設定ファイルの収集
# ==========================================
echo "🔑 [2/4] 機密ファイルを収集中..."

# .env ファイル群 (除外: .env.example, *.erb)
find . -maxdepth 1 -name ".env*" ! -name "*.erb" ! -name ".env.example" | while read file; do
  cp "$file" "$TEMP_DIR/"
  echo "   ✅ $file"
done

# master.key
if [ -f "config/master.key" ]; then
  mkdir -p "$TEMP_DIR/config"
  cp config/master.key "$TEMP_DIR/config/"
  echo "   ✅ config/master.key"
fi

# credentials.yml.enc (念のため)
if [ -f "config/credentials.yml.enc" ]; then
  mkdir -p "$TEMP_DIR/config"
  cp config/credentials.yml.enc "$TEMP_DIR/config/"
  echo "   ✅ config/credentials.yml.enc"
fi

# VSCode設定
if [ -d ".vscode" ]; then
  cp -r .vscode "$TEMP_DIR/"
  echo "   ✅ .vscode/"
fi

# ==========================================
# 3. アップロードファイル (ActiveStorage)
# ==========================================
echo "📂 [3/4] ストレージファイルを収集中..."

if [ -d "storage" ]; then
  mkdir -p "$TEMP_DIR/storage"
  # エラー抑制のため || : を追加
  cp -r storage/* "$TEMP_DIR/storage/" 2>/dev/null || :
  echo "   ✅ storage/"
else
  echo "   ⚠️ storageディレクトリが見つかりません（スキップ）"
fi

# ==========================================
# 4. ZIP圧縮と保存
# ==========================================
echo "asd [4/4] ZIPアーカイブを作成中..."

ZIP_FILENAME="${PROJECT_NAME}_full_backup_${TIMESTAMP}.zip"
ZIP_FILEPATH="$BACKUP_DIR/$ZIP_FILENAME"

# 一時ディレクトリに移動してZIP化
cd "$TEMP_DIR"
zip -r "$ZIP_FILEPATH" . > /dev/null

# 元の場所に戻る
cd "$PROJECT_ROOT"

# 一時ディレクトリ削除
rm -rf "$TEMP_DIR"

echo "🎉 バックアップ完了！"
echo "---------------------------------------------------"
echo "📁 ファイル: $ZIP_FILEPATH"
echo "📦 サイズ: $(du -h "$ZIP_FILEPATH" | cut -f1)"
echo "---------------------------------------------------"
