#!/bin/bash
set -euo pipefail

IMAGE_NAME="${BACKEND_OGP_IMAGE_NAME:-aruaruarena-backend-ogp-test}"
HOST_DYNAMODB_ENDPOINT="${HOST_DYNAMODB_ENDPOINT:-http://127.0.0.1:8002}"
CONTAINER_DYNAMODB_ENDPOINT="${CONTAINER_DYNAMODB_ENDPOINT:-http://host.docker.internal:8002}"
DYNAMODB_CONTAINER_NAME="${DYNAMODB_CONTAINER_NAME:-aruaruarena-dynamodb-test}"
SKIP_IMAGE_BUILD="${SKIP_BACKEND_OGP_IMAGE_BUILD:-0}"
OGP_E2E_BASE_URL="${OGP_E2E_BASE_URL:-}"
OGP_E2E_POST_ID="${OGP_E2E_POST_ID:-}"
OGP_E2E_S3_BUCKET="${OGP_E2E_S3_BUCKET:-}"
OGP_E2E_AWS_REGION="${OGP_E2E_AWS_REGION:-ap-northeast-1}"

cd "$(dirname "$0")/.."

require_env_pair() {
  local left_name="$1"
  local left_value="$2"
  local right_name="$3"
  local right_value="$4"

  if [ -n "${left_value}" ] && [ -n "${right_value}" ]; then
    return
  fi

  if [ -z "${left_value}" ] && [ -z "${right_value}" ]; then
    return
  fi

  echo "🚨 ${left_name} と ${right_name} は両方セットする必要があります"
  exit 1
}

dynamodb_is_healthy() {
  local response
  response=$(curl -sS --max-time 3 "${HOST_DYNAMODB_ENDPOINT}" 2>&1 || true)
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

ensure_dynamodb() {
  if dynamodb_is_healthy || dynamodb_container_is_healthy; then
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
  for count in $(seq 1 60); do
    if dynamodb_is_healthy || dynamodb_container_is_healthy; then
      echo "✅ DynamoDB Local OK"
      return
    fi
    echo "   ...waiting for DynamoDB Local (${count}/60)"
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

check_e2e_static_delivery() {
  require_env_pair "OGP_E2E_BASE_URL" "${OGP_E2E_BASE_URL}" "OGP_E2E_POST_ID" "${OGP_E2E_POST_ID}"

  if [ -z "${OGP_E2E_BASE_URL}" ]; then
    echo "ℹ️  OGP E2E静的配信チェックは未設定のためスキップします"
    echo "   実行する場合は OGP_E2E_BASE_URL と OGP_E2E_POST_ID を指定してください"
    return
  fi

  local normalized_base_url post_url image_url image_headers html_response
  normalized_base_url="${OGP_E2E_BASE_URL%/}"
  post_url="${normalized_base_url}/posts/${OGP_E2E_POST_ID}"
  image_url="${normalized_base_url}/ogp/posts/${OGP_E2E_POST_ID}.png"

  echo "🌐 OGP静的配信E2Eチェックを実行します..."
  echo "   HTML: ${post_url}"
  echo "   PNG : ${image_url}"

  html_response=$(curl -fsS -A "Twitterbot/1.0" "${post_url}")
  [[ "${html_response}" == *"property=\"og:image\" content=\"${image_url}\""* ]] || {
    echo "🚨 og:image が期待値と一致しません"
    exit 1
  }
  [[ "${html_response}" == *"name=\"twitter:image\" content=\"${image_url}\""* ]] || {
    echo "🚨 twitter:image が期待値と一致しません"
    exit 1
  }
  echo "✅ Twitterbot向けHTMLに og:image / twitter:image を確認しました"

  image_headers=$(curl -fsSI "${image_url}")
  [[ "${image_headers}" == *"200"* ]] || {
    echo "🚨 CloudFront 画像レスポンスが 200 ではありません"
    exit 1
  }
  [[ "${image_headers}" == *"content-type: image/png"* ]] || {
    echo "🚨 CloudFront 画像レスポンスの content-type が image/png ではありません"
    exit 1
  }
  [[ "${image_headers}" == *"server: AmazonS3"* ]] || {
    echo "🚨 CloudFront が S3 実体を返していません"
    exit 1
  }

  local content_length
  content_length=$(printf '%s\n' "${image_headers}" | awk 'BEGIN{IGNORECASE=1} /^content-length:/ {gsub("\r", "", $2); print $2; exit}')
  if [ -z "${content_length}" ] || [ "${content_length}" -le 0 ]; then
    echo "🚨 CloudFront 画像レスポンスの content-length が不正です: ${content_length:-missing}"
    exit 1
  fi
  echo "✅ CloudFront が S3 由来の PNG を静的配信しています"

  if [ -n "${OGP_E2E_S3_BUCKET}" ]; then
    aws s3api head-object \
      --bucket "${OGP_E2E_S3_BUCKET}" \
      --key "ogp/posts/${OGP_E2E_POST_ID}.png" \
      --region "${OGP_E2E_AWS_REGION}" > /dev/null
    echo "✅ S3 に OGP オブジェクトが存在します"
  else
    echo "ℹ️  OGP_E2E_S3_BUCKET 未設定のため S3 head-object 確認はスキップします"
  fi
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

check_e2e_static_delivery
