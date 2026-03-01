#!/bin/bash
set -euo pipefail

IMAGE_NAME="${BACKEND_OGP_IMAGE_NAME:-aruaruarena-backend-ogp-test}"
HOST_DYNAMODB_ENDPOINT="${HOST_DYNAMODB_ENDPOINT:-http://127.0.0.1:8002}"
CONTAINER_DYNAMODB_ENDPOINT="${CONTAINER_DYNAMODB_ENDPOINT:-http://host.docker.internal:8002}"
DYNAMODB_CONTAINER_NAME="${DYNAMODB_CONTAINER_NAME:-aruaruarena-dynamodb-test}"
SKIP_IMAGE_BUILD="${SKIP_BACKEND_OGP_IMAGE_BUILD:-0}"

cd "$(dirname "$0")/.."

dynamodb_is_healthy() {
  local response
  response=$(curl -s --max-time 3 "${HOST_DYNAMODB_ENDPOINT}" 2>&1)
  [[ -n "$response" && ("$response" == *"MissingAuthenticationToken"* || "$response" == *"__type"* || "$response" == *"com.amazon"* || "$response" == *"healthy"*) ]]
}

ensure_dynamodb() {
  if dynamodb_is_healthy; then
    echo "✅ DynamoDB Local OK"
    return
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
  for _ in $(seq 1 10); do
    if dynamodb_is_healthy; then
      echo "✅ DynamoDB Local OK"
      return
    fi
    sleep 1
  done

  echo "🚨 DynamoDB Localの起動に失敗しました"
  exit 1
}

ensure_image() {
  if [ "${SKIP_IMAGE_BUILD}" = "1" ] && docker image inspect "${IMAGE_NAME}" > /dev/null 2>&1; then
    echo "✅ backendイメージを再利用します: ${IMAGE_NAME}"
    return
  fi

  echo "🏗️  backendイメージをビルドします: ${IMAGE_NAME}"
  docker build -t "${IMAGE_NAME}" backend
}

echo "🖼️ Docker上でOGPスモークチェックを実行します..."
ensure_dynamodb
ensure_image

docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  --entrypoint bash \
  -e RAILS_ENV=test \
  -e SECRET_KEY_BASE=dummy-secret-for-ogp-smoke \
  -e AWS_ACCESS_KEY_ID=dummy \
  -e AWS_SECRET_ACCESS_KEY=dummy \
  -e AWS_REGION=ap-northeast-1 \
  -e DYNAMODB_ENDPOINT="${CONTAINER_DYNAMODB_ENDPOINT}" \
  -e GEMINI_API_KEY=dummy-gemini \
  -e CEREBRAS_API_KEY=dummy-cerebras \
  -e GROQ_API_KEY=dummy-groq \
  "${IMAGE_NAME}" \
  -lc "bundle exec rails runner -e test scripts/ogp_smoke_check.rb"
