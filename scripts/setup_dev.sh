#!/bin/bash
set -e

# ==========================================
# 開発環境セットアップスクリプト
# ==========================================

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

echo "🚀 開発環境のセットアップを開始します..."

# 1. Dockerコンテナの起動
echo "📦 [1/3] Dockerコンテナを起動中..."
docker compose up -d
echo "   ✅ Dockerコンテナ起動完了"

# 2. バックエンドのセットアップ
echo "💎 [2/3] Backend: bundle install..."
cd backend
bundle check || bundle install
echo "   ✅ bundle install完了"
cd ..
cd ..

# 3. データベース準備 (DynamoDB Local)
# DynamoDBはスキーマレスなのでマイグレーション不要だが、
# テスト用テーブルの作成などが必要な場合はここに記述
echo "🗄️  [3/3] Database setup..."
# 必要なら: bundle exec rake dynamoid:create_tables

echo "----------------------------------------"
echo "🎉 セットアップ完了！"
echo "   './scripts/test_all.sh' でテストを実行できます。"
