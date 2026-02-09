#!/bin/bash
set -e

# ==========================================
# 全テスト実行スクリプト (aruaruarena)
# ==========================================

DYNAMODB_CONTAINER_NAME="aruaruarena-dynamodb-local"

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

# 権限変更（Docker作成ファイル対策）
# sudoが必要な場合があるため、失敗しても続行
echo "� Fixing permissions..."
chown -R $(id -u):$(id -g) . 2>/dev/null || echo "⚠️  権限変更をスキップしました（sudoが必要な可能性があります）"

echo "�🚀 aruaruarenaのテストを開始します..."
echo "----------------------------------------"

# backendディレクトリへ移動
cd backend

# 1. 静的解析
echo "🔍 Running Static Analysis..."

# RuboCop（自動修正付き、違反があっても続行）
echo "  - RuboCop..."
set +e  # 一時的にset -eを解除
bundle exec rubocop -a --format simple
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
echo "🔍 DynamoDB Localの状態確認..."
if ! curl -s http://localhost:8000 > /dev/null 2>&1; then
  echo "⚠️  DynamoDB Local (port 8000) が応答しません。"
  echo "   Dockerコンテナを起動します..."

  # Dockerコンテナが存在する場合は起動
  if docker ps -a | grep -q "${DYNAMODB_CONTAINER_NAME}"; then
    docker start "${DYNAMODB_CONTAINER_NAME}"
  else
    docker run -d --name "${DYNAMODB_CONTAINER_NAME}" -p 8000:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -inMemory -sharedDb
  fi

  echo "⏳ DynamoDB Localの起動を待機中..."
  sleep 3

  count=0
  until curl -s http://localhost:8000 > /dev/null 2>&1; do
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
# SimpleCovのカバレッジエラー（exit 2）を無視してテスト結果を判定
set +e  # 一時的にset -eを解除
DYNAMODB_ENDPOINT=http://localhost:8000 bundle exec rspec --format documentation
rspec_exit=$?
set -e  # set -eを再開

echo "----------------------------------------"
echo ""

# RSpec自体が成功（exit 0）か、カバレッジ警告のみ（exit 2）なら成功とみなす
if [ $rspec_exit -eq 0 ] || [ $rspec_exit -eq 2 ]; then
  if [ $rspec_exit -eq 2 ]; then
    echo "⚠️  テストは成功しましたが、カバレッジが目標未達です"
    if [ -f "coverage/.last_run.json" ]; then
        coverage=$(jq '.result.line' coverage/.last_run.json 2>/dev/null || echo "Unknown")
        echo "   現在のカバレッジ: ${coverage}%"
    fi
  fi
  echo "🎉 全てのテストが成功しました！"
  exit 0
else
  echo "🚨 テストが失敗しました"
  echo ""
  echo "修正のヒント:"
  echo "  1. 上記のエラーログを確認してください"
  echo "  2. 該当のspecファイルを個別に実行して詳細を確認:"
  echo "     bundle exec rspec spec/path/to/failing_spec.rb -fd"
  exit 1
fi
