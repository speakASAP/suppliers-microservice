#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="$(basename "$PROJECT_ROOT")"
REGISTRY="localhost:5000"
NAMESPACE="statex-apps"
DEFAULT_TAG="$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "build-$(date -u +%Y%m%d%H%M%S)")"
IMAGE_TAG="${1:-$DEFAULT_TAG}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"
PORT="$2"

echo -e "\033[0;34m╔════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;34m║  $SERVICE_NAME — Kubernetes Deployment               ║\033[0m"
echo -e "\033[0;34m╚════════════════════════════════════════════════════════╝\033[0m"

echo -e "\033[1;33m[1/5] Building image: ${IMAGE}...\033[0m"
docker build -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT" || exit 1
echo -e "\033[0;32m✅ Image built\033[0m"

echo -e "\033[1;33m[2/5] Pushing to registry...\033[0m"
docker push "$IMAGE" || exit 1
docker push "$IMAGE_LATEST" || exit 1
echo -e "\033[0;32m✅ Image pushed\033[0m"

echo -e "\033[1;33m[3/5] Updating K8s deployment...\033[0m"
kubectl set image deployment/${SERVICE_NAME} app="${IMAGE_LATEST}" -n "${NAMESPACE}" || true
echo -e "\033[0;32m✅ Deployment updated\033[0m"

echo -e "\033[1;33m[4/5] Waiting for rollout...\033[0m"
if ! kubectl rollout status deployment/${SERVICE_NAME} -n "${NAMESPACE}" --timeout=120s; then
  echo -e "\033[1;33mRollout did not complete in time. Diagnosing terminating pods...\033[0m"
  kubectl get pods -n "${NAMESPACE}" -l app=${SERVICE_NAME} -o wide || true
  TERMINATING_PODS=$(kubectl get pods -n "${NAMESPACE}" -l app=${SERVICE_NAME} --no-headers 2>/dev/null | awk '$3=="Terminating"{print $1}')
  if [ -n "$TERMINATING_PODS" ]; then
    echo -e "\033[1;33mForce deleting stuck terminating pods...\033[0m"
    for pod in $TERMINATING_PODS; do
      kubectl delete pod -n "${NAMESPACE}" "$pod" --grace-period=0 --force || true
    done
  fi
  kubectl rollout status deployment/${SERVICE_NAME} -n "${NAMESPACE}" --timeout=120s
fi
echo -e "\033[0;32m✅ Rollout status checked\033[0m"

echo -e "\033[0;32m╔════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;32m║            ✅ Deployment complete!                     ║\033[0m"
echo -e "\033[0;32m║  Image: ${IMAGE}                       ║\033[0m"
echo -e "\033[0;32m╚════════════════════════════════════════════════════════╝\033[0m"
