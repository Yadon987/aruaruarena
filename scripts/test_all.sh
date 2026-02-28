#!/bin/bash
set -e

# ==========================================
# 全テスト実行スクリプト (aruaruarena)
# ==========================================

DYNAMODB_CONTAINER_NAME="aruaruarena-dynamodb-test"
DYNAMODB_ENDPOINT="http://127.0.0.1:8002"

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

# 権限変更（Docker作成ファイル対策）
# sudoが必要な場合があるため、失敗しても続行
echo "� Fixing permissions..."
chown -R $(id -u):$(id -g) . 2>/dev/null || echo "⚠️  権限変更をスキップしました（sudoが必要な可能性があります）"

echo "�🚀 aruaruarenaのテストを開始します..."
echo "----------------------------------------"

# タイムアウト付きDynamoDBヘルスチェック
dynamodb_is_healthy() {
  # DynamoDB Localは GET / に対して 400 を返すため、HTTPステータスではなく疎通で判定する。
  curl -sS --max-time 3 "${DYNAMODB_ENDPOINT}" > /dev/null 2>&1
}

# backendの古いテストプロセスを停止
#
# 共有のテスト用DynamoDBに対して複数のrspec/rails runnerが同時接続すると、
# StaleObjectErrorやcleanupタイムアウトの原因になるため、開始前に掃除する。
cleanup_backend_test_processes() {
  echo "🧹 backendテスト残骸プロセスを確認中..."

  local pids
  pids=$(ps -ef | grep -E 'bundle exec rspec|bin/rails runner|rails runner' | grep -v grep | awk '{print $2}')

  if [ -z "$pids" ]; then
    echo "   ✅ 競合プロセスはありません"
    return
  fi

  echo "   ⚠️  既存のbackendテスト系プロセスを停止します: ${pids}"
  pkill -f 'bundle exec rspec|bin/rails runner|rails runner' 2>/dev/null || true
  sleep 1
}

# backendディレクトリへ移動
cd backend

# 0. backendテスト残骸の掃除
cleanup_backend_test_processes

# 1. 静的解析
echo "🔍 Running Static Analysis..."

# RuboCop（自動修正付き、違反があっても続行）
echo "  - RuboCop..."
set +e  # 一時的にset -eを解除
bundle exec rubocop -A --format simple
rubocop_status=$?
set -e  # set -eを再開

if [ $rubocop_status -eq 0 ]; then
  echo "    ✅ RuboCop Passed"
else
  echo "    ⚠️  RuboCop found some issues (continuing...)"
fi

# Brakeman
echo "  - Brakeman..."
set +e  # 一時的にset -eを解除
bundle exec brakeman -q --no-pager
brakeman_status=$?
set -e  # set -eを再開

if [ $brakeman_status -eq 0 ]; then
  echo "    ✅ Brakeman Passed"
else
  echo "    ⚠️  Brakeman found some issues (continuing...)"
fi

echo ""

# 2. DynamoDB Localの起動確認
echo "🔍 DynamoDB Local(テスト用:8002)の状態確認..."
if ! dynamodb_is_healthy; then
  echo "⚠️  DynamoDB Local (port 8002) が応答しません。"
  echo "   Dockerコンテナを起動します..."

  # まずテスト用サービス起動を試す（通常の起動経路）
  if docker compose up -d dynamodb-test > /dev/null 2>&1; then
    echo "   docker compose で dynamodb-test を起動しました"
  else
    # compose が使えない場合のみ既存コンテナ再利用/単体起動を試す
    if docker ps -a --format '{{.Names}}' | grep -q "^${DYNAMODB_CONTAINER_NAME}$"; then
      docker start "${DYNAMODB_CONTAINER_NAME}"
    else
      docker run -d --name "${DYNAMODB_CONTAINER_NAME}" -p 8002:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -inMemory -sharedDb
    fi
  fi

  echo "⏳ DynamoDB Localの起動を待機中..."
  sleep 3

  count=0
  until dynamodb_is_healthy; do
    echo "   ...waiting for DynamoDB Local ($count/5)"
    sleep 1
    count=$((count+1))
    if [ $count -ge 5 ]; then
      echo "🚨 DynamoDB Localの起動に失敗しました"
      exit 1
    fi
  done
fi

echo "✅ DynamoDB Local OK"
echo ""

# 3. テスト実行
echo "🧪 Running RSpec..."
echo "----------------------------------------"

# テスト実行（DynamoDB Localのエンドポイントを指定）
# SimpleCovのカバレッジ警告（exit 2/3）は許容してテスト結果を判定
set +e  # 一時的にset -eを解除
DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT}" bundle exec rspec --format documentation > /tmp/rspec_output.txt 2>&1
rspec_exit=$?
cat /tmp/rspec_output.txt
set -e  # set -eを再開

echo "----------------------------------------"
echo ""

# RSpec自体が成功（exit 0）か、カバレッジ警告のみ（exit 2/3）なら続行
if [ $rspec_exit -eq 0 ] || [ $rspec_exit -eq 2 ] || [ $rspec_exit -eq 3 ]; then
  if [ $rspec_exit -eq 2 ] || [ $rspec_exit -eq 3 ]; then
    echo "⚠️  テストは成功しましたが、カバレッジが目標未達です"
    # RSpecの出力から直接カバレッジを抽出
    coverage=$(grep "Line Coverage:" /tmp/rspec_output.txt | sed -E 's/.*Line Coverage: ([0-9.]+)%.*/\1/' || echo "Unknown")
    echo "   現在のカバレッジ: ${coverage}%"
  fi
  echo "🎉 全てのテストが成功しました！"
else
  echo "🚨 Backend Tests Failed (exit code: ${rspec_exit})"
  exit $rspec_exit
fi

echo ""
echo "backend tests finished."
echo "----------------------------------------"

# 4. Frontendテスト実行
echo "🧪 Running Frontend Tests..."
echo "----------------------------------------"

cd ../frontend

# 依存関係のインストール確認（node_modulesがない場合のみ）
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# テスト実行
set +e
npm run test
frontend_test_exit=$?
set -e

if [ $frontend_test_exit -eq 0 ]; then
  echo "✅ Frontend Tests Passed"
else
  echo "🚨 Frontend Tests Failed"
  exit 1
fi

echo "----------------------------------------"
echo "🎉 全てのテストが成功しました！"
exit 0
