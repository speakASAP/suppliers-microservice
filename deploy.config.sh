# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 (Phase C) for the design.
# scripts/deploy.sh is still the live, authoritative deploy path.

SERVICE_NAME="suppliers-microservice"
PORT="3202"

IMAGES=(
  "suppliers-microservice|.||"
)

DEPLOYMENTS=(
  "suppliers-microservice|app|suppliers-microservice"
)

# MANIFESTS left at the runner default (configmap, external-secret, deployment,
# service, ingress) — matches the real script's manifest loop exactly.
