#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="$(basename "$PROJECT_ROOT")"
REGISTRY="localhost:5000"
NAMESPACE="statex-apps"
IMAGE_TAG="${1:-latest}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
PORT="$2"

echo -e "\033[0;34m╔════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;34m║  $SERVICE_NAME — Kubernetes Deployment               ║\033[0m"
echo -e "\033[0;34m╚════════════════════════════════════════════════════════╝\033[0m"

echo -e "\033[1;33m[1/5] Building image: ${IMAGE}...\033[0m"
docker build -t "$IMAGE" "$PROJECT_ROOT" || exit 1
echo -e "\033[0;32m✅ Image built\033[0m"

echo -e "\033[1;33m[2/5] Pushing to registry...\033[0m"
docker push "$IMAGE" || exit 1
echo -e "\033[0;32m✅ Image pushed\033[0m"

echo -e "\033[1;33m[3/5] Updating K8s deployment...\033[0m"
kubectl set image deployment/${SERVICE_NAME} app="${IMAGE}" -n "${NAMESPACE}" || true
echo -e "\033[0;32m✅ Deployment updated\033[0m"

echo -e "\033[1;33m[4/5] Waiting for rollout...\033[0m"
kubectl rollout status deployment/${SERVICE_NAME} -n "${NAMESPACE}" --timeout=120s || true
echo -e "\033[0;32m✅ Rollout status checked\033[0m"

echo -e "\033[0;32m╔════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;32m║            ✅ Deployment complete!                     ║\033[0m"
echo -e "\033[0;32m║  Image: ${IMAGE}                       ║\033[0m"
echo -e "\033[0;32m╚════════════════════════════════════════════════════════╝\033[0m"
