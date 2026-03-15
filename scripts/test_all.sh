#!/bin/bash
set -euo pipefail

# ==========================================
# 全テスト実行スクリプト (aruaruarena)
# ==========================================

DYNAMODB_CONTAINER_NAME="aruaruarena-dynamodb-test"
DYNAMODB_ENDPOINT="http://127.0.0.1:8002"
LOG_DIR="/tmp/aruaru_test_$$"
RSPEC_COVERAGE_WARN=0

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

mkdir -p "${LOG_DIR}"
trap 'rm -rf "${LOG_DIR}"' EXIT

if [ "${1:-}" = "--fast" ]; then
  export SKIP_BACKEND_OGP_IMAGE_BUILD=1
fi

export DOCKER_BUILDKIT=1

echo "🚀 aruaruarenaのテストを開始します..."
echo "----------------------------------------"
echo "📁 ログ出力先: ${LOG_DIR}"
echo ""

# タイムアウト付きDynamoDBヘルスチェック
dynamodb_is_healthy() {
  # DynamoDB Localは GET / に対して認証エラーJSONを返すため、
  # その応答を確認して疎通を判定する。
  local response
  response=$(curl -sS --max-time 3 "${DYNAMODB_ENDPOINT}" 2>&1 || true)
  # 認証エラーメッセージまたは空でない応答があれば成功
  [[ -n "$response" && ("$response" == *"MissingAuthenticationToken"* || "$response" == *"__type"* || "$response" == *"com.amazon"* || "$response" == *"healthy"*) ]]
}

dynamodb_container_is_healthy() {
  if ! docker ps -a --format '{{.Names}}' | grep -q "^${DYNAMODB_CONTAINER_NAME}$"; then
    return 1
  fi

  local health_status
  health_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${DYNAMODB_CONTAINER_NAME}" 2>/dev/null || true)
  [[ "${health_status}" == "healthy" || "${health_status}" == "running" ]]
}

# backendの古いテストプロセスを停止
#
# 共有のテスト用DynamoDBに対して複数のrspec/rails runnerが同時接続すると、
# StaleObjectErrorやcleanupタイムアウトの原因になるため、開始前に掃除する。
cleanup_backend_test_processes() {
  echo "🧹 backendテスト残骸プロセスを確認中..."

  local pids
  pids=$(ps -ef | grep -E 'bundle exec rspec|bin/rails runner|rails runner' | grep -v grep | awk '{print $2}' || true)

  if [ -z "$pids" ]; then
    echo "   ✅ 競合プロセスはありません"
    return
  fi

  echo "   ⚠️  既存のbackendテスト系プロセスを停止します: ${pids}"
  pkill -f 'bundle exec rspec|bin/rails runner|rails runner' 2>/dev/null || true
  sleep 1
}

run_static_analysis() {
  cd backend
  set +e
  bundle exec rubocop -A --format simple
  local rubocop_status=$?
  bundle exec brakeman -q --no-pager
  local brakeman_status=$?
  set -e

  if [ "${rubocop_status}" -eq 0 ] && [ "${brakeman_status}" -eq 0 ]; then
    return 0
  fi
  return 1
}

run_vitest() {
  cd frontend
  npm ci
  npm run test
}

ensure_dynamodb() {
  cd "$(dirname "$0")/.."
  if dynamodb_is_healthy || dynamodb_container_is_healthy; then
    echo "✅ DynamoDB Local OK"
    return 0
  fi

  echo "⚠️  DynamoDB Local (port 8002) が応答しません。起動を試みます..."

  if docker compose up -d dynamodb-test > /dev/null 2>&1; then
    echo "   docker compose で dynamodb-test を起動しました"
  else
    if docker ps -a --format '{{.Names}}' | grep -q "^${DYNAMODB_CONTAINER_NAME}$"; then
      docker start "${DYNAMODB_CONTAINER_NAME}" > /dev/null
    else
      docker run -d --name "${DYNAMODB_CONTAINER_NAME}" -p 8002:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -inMemory -sharedDb > /dev/null
    fi
  fi

  echo "⏳ DynamoDB Localの起動を待機中..."
  count=0
  until dynamodb_is_healthy || dynamodb_container_is_healthy; do
    count=$((count + 1))
    if [ ${count} -ge 60 ]; then
      echo "🚨 DynamoDB Localの起動に失敗しました"
      return 1
    fi
    echo "   ...waiting for DynamoDB Local (${count}/60)"
    sleep 1
  done

  echo "✅ DynamoDB Local OK"
}

run_rspec() {
  cd backend
  set +e
  DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT}" bundle exec rspec --format progress
  rspec_exit=$?
  set -e

  if [ ${rspec_exit} -eq 2 ] || [ ${rspec_exit} -eq 3 ]; then
    RSPEC_COVERAGE_WARN=1
    return 0
  fi

  return ${rspec_exit}
}

run_ogp_check() {
  cd "$(dirname "$0")/.."
  bash scripts/check_ogp_docker.sh
}

print_status() {
  local name="$1"
  local status="$2"
  if [ "${status}" -eq 0 ]; then
    echo "✅ ${name}"
  else
    echo "🚨 ${name} (exit: ${status})"
  fi
}

show_failed_log() {
  local name="$1"
  local status="$2"
  local path="$3"
  if [ "${status}" -eq 0 ]; then
    return
  fi
  echo ""
  echo "----- ${name} 失敗ログ: ${path} -----"
  cat "${path}"
  echo "----- ${name} 失敗ログここまで -----"
}

cleanup_backend_test_processes

echo "🧵 Phase 1 (並行): 静的解析 / Vitest / DynamoDB"
(run_static_analysis) > "${LOG_DIR}/static.log" 2>&1 &
static_pid=$!
(run_vitest) > "${LOG_DIR}/vitest.log" 2>&1 &
vitest_pid=$!
(ensure_dynamodb) > "${LOG_DIR}/dynamodb.log" 2>&1 &
dynamodb_pid=$!

set +e
wait "${static_pid}"; static_status=$?
wait "${vitest_pid}"; vitest_status=$?
wait "${dynamodb_pid}"; dynamodb_status=$?
set -e

echo "🔁 Phase 2 (直列): RSpec → OGP Check"
if [ "${dynamodb_status}" -eq 0 ]; then
  set +e
  (run_rspec) > "${LOG_DIR}/rspec.log" 2>&1
  rspec_status=$?
  set -e

  set +e
  (run_ogp_check) > "${LOG_DIR}/ogp.log" 2>&1
  ogp_status=$?
  set -e
else
  echo "DynamoDB 起動失敗のため RSpec と OGP Check をスキップしました" > "${LOG_DIR}/rspec.log"
  echo "DynamoDB 起動失敗のため OGP Check をスキップしました" > "${LOG_DIR}/ogp.log"
  rspec_status=1
  ogp_status=1
fi

echo ""
echo "=========================================="
echo "テスト結果サマリ"
echo "=========================================="
print_status "静的解析" "${static_status}"
print_status "Vitest" "${vitest_status}"
print_status "DynamoDB" "${dynamodb_status}"
print_status "RSpec" "${rspec_status}"
print_status "OGP Check" "${ogp_status}"

if [ "${RSPEC_COVERAGE_WARN}" -eq 1 ]; then
  echo "⚠️  RSpecは成功しましたが、カバレッジが目標未達です (exit 2/3)"
fi

show_failed_log "静的解析" "${static_status}" "${LOG_DIR}/static.log"
show_failed_log "Vitest" "${vitest_status}" "${LOG_DIR}/vitest.log"
show_failed_log "DynamoDB" "${dynamodb_status}" "${LOG_DIR}/dynamodb.log"
show_failed_log "RSpec" "${rspec_status}" "${LOG_DIR}/rspec.log"
show_failed_log "OGP Check" "${ogp_status}" "${LOG_DIR}/ogp.log"

if [ "${static_status}" -eq 0 ] \
  && [ "${vitest_status}" -eq 0 ] \
  && [ "${dynamodb_status}" -eq 0 ] \
  && [ "${rspec_status}" -eq 0 ] \
  && [ "${ogp_status}" -eq 0 ]; then
  echo ""
  echo "🎉 全てのテストが成功しました！"
  exit 0
fi

exit 1
