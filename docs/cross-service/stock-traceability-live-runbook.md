# Cross-Service Stock Traceability Live Runbook

Metadata:
- id: CROSS-STOCK-TRACEABILITY-LIVE-RUNBOOK
- status: ready-for-owner-approval
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- upstream: docs/cross-service/stock-traceability-runtime-rollout.md, reports/validation/runtime-stock-traceability-smoke.js

## Purpose

This runbook gives the concrete owner-approved deployment and smoke commands for proving one Catalog good can be traced through Alfares-owned Warehouse stock, supplier and dropship Warehouse stock, Warehouse logistics routes, Catalog coverage, and Suppliers import evidence.

## Approval Gate

Stop unless the owner explicitly approves all three actions in the current session:

1. Deploy Warehouse, Catalog, and Suppliers source currently present on `alfares`.
2. Create or reuse synthetic traceability records only.
3. Run one approved Suppliers synthetic import that mutates Warehouse supplier and dropship stock.

Do not paste real JWTs, service tokens, supplier credentials, raw supplier payloads, customer data, or production stock response bodies into docs or chat. Keep token values in shell environment only.

## Required Inputs

Prepare these values before deploying:

| Variable | Meaning |
| --- | --- |
| `TRACE_PRODUCT_ID` | Approved synthetic Catalog product ID with a `CODEX-STOCK-TRACE-` SKU prefix. |
| `TRACE_PRODUCT_SKU_PREFIX` | Required synthetic SKU prefix. Use `CODEX-STOCK-TRACE-` unless the owner approves another isolated prefix. |
| `TRACE_SUPPLIER_ID` | Active Suppliers supplier ID whose code is `synthetic-trace`. |
| `TRACE_SUPPLIER_WAREHOUSE_ID` | Warehouse supplier replenishment location linked to `TRACE_SUPPLIER_ID`. |
| `TRACE_DROPSHIP_WAREHOUSE_ID` | Warehouse dropship location linked to `TRACE_SUPPLIER_ID`. |
| `TRACE_IMPORT_IDEMPOTENCY_KEY` | Stable replay key for this approved smoke, for example `manual:traceability-20260613-001`. |
| `TRACE_CLEANUP_EVIDENCE` | Completed cleanup evidence or explicit deferral reference, for example `deferred:stock-traceability-runbook-20260613`. |
| `CATALOG_TOKEN` | Approved Catalog bearer token with read access to protected Catalog endpoints. |
| `WAREHOUSE_TOKEN` | Approved Warehouse bearer token with read access and supplier reconciliation permission. |
| `SUPPLIERS_TOKEN` | Approved Suppliers bearer token with import-job access. |
| `CATALOG_SERVICE_URL` / `CATALOG_SERVICE_TOKEN` | Suppliers runtime configuration used to verify Catalog product identity before approved Warehouse stock mutation. Keep token value in the runtime environment only. |

## Pre-Deploy Snapshot

Run the cross-service preflight from the operator workstation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && node reports/validation/cross-service-preflight-check.js'
```

Also capture the raw git snapshot:

```bash
ssh alfares 'for r in warehouse-microservice catalog-microservice suppliers-microservice; do cd /home/ssf/Documents/Github/$r && printf "\n== %s ==\n" "$r" && git rev-parse HEAD && git status --short; done'
```

All three repositories must be clean before generating deployment evidence or running approved runtime evidence. If any `git status --short` output is non-empty, stop, commit or intentionally remove the change, then regenerate the handoff and deployment evidence from the new clean heads.

## Source Validation

Run the last non-mutating validation before deployment:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/warehouse-microservice && npm test -- --runInBand && npm run build && git diff --check'
ssh alfares 'cd /home/ssf/Documents/Github/catalog-microservice && npm test -- --runInBand && npm run build && git diff --check'
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && npm run build && node reports/validation/cross-service-preflight-check.js && node reports/validation/run-runtime-evidence-flow.js --plan-only && node reports/validation/run-runtime-evidence-flow.js --manifest-self-test && node reports/validation/create-deployment-evidence-template.js --self-test && node reports/validation/create-runtime-handoff-checklist.js --self-test && node reports/validation/verify-runtime-evidence-manifest.js --self-test && node reports/validation/verify-runtime-evidence-bundle.js --self-test && node reports/validation/generate-runtime-evidence-report.js --self-test && node reports/validation/verify-runtime-evidence-report.js --self-test && node reports/validation/runtime-evidence-negative-check.js && node reports/validation/runtime-evidence-flow-negative-check.js && node reports/validation/synthetic-approved-import-run-check.js && node reports/validation/production-rest-json-adapter-check.js && node reports/validation/synthetic-production-rest-json-adapter-check.js && node reports/validation/synthetic-stock-traceability-check.js && node reports/validation/runtime-stock-traceability-smoke.js --plan-only && python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues && python3 scripts/deployment_readiness_gate.py --root . && git diff --check'
```

## Guarded Evidence Flow

Use the guarded evidence runner to prevent out-of-order runtime proof. Plan the flow first:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && node reports/validation/run-runtime-evidence-flow.js --plan-only'
```

Run the read-only fixture phase without mutation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=<catalog-token> WAREHOUSE_TOKEN=<warehouse-token> SUPPLIERS_TOKEN=<suppliers-token> TRACE_PRODUCT_ID=<approved-synthetic-product-id> TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=<own-warehouse-id> TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id> TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id> node reports/validation/run-runtime-evidence-flow.js'
```

Only after owner approval and deployment evidence are ready, continue with `RUN_APPROVED_RUNTIME_SMOKE=true`, `OWNER_APPROVAL=explicit`, and `SMOKE_ALLOW_MUTATION=true`. The same command with `--config-only` validates approved-smoke prerequisites, requires deployment evidence generated by `create-deployment-evidence-template.js` with `generatedFromCurrentHeads: true` and the completion-verifier reminder, checks deployment commit SHAs against the current remote repository HEADs, and rejects dirty Warehouse, Catalog, or Suppliers worktrees. In real execution, the runner also validates owner approval, mutation allowance, cleanup evidence, clean source state, and deployment evidence before the read-only fixture phase, so incomplete, stale, or uncommitted-source deployment evidence cannot reach the approved import step. Use the guarded runner for approved evidence; the low-level smoke script is retained for plan-only and fixture internals, not as the operator completion path. The runner writes fixture/smoke JSON, generates the final report, and verifies it.

## Read-Only Fixture Check

Before mutation approval, run the live fixture readiness check. It reads the three services and verifies the product already exposes own, supplier replenishment, and dropship stock rows plus route legs; it refuses mutation flags.

\`\`\`bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=<approved-synthetic-product-id> TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=<own-warehouse-id> TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id> TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id> node reports/validation/runtime-stock-traceability-smoke.js --fixture-check'
\`\`\`

## Deploy In Order

Deploy Warehouse first:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/warehouse-microservice && ./scripts/deploy.sh'
curl -sk https://warehouse.alfares.cz/api/health
curl -sk -o /dev/null -w "%{http_code}\n" https://warehouse.alfares.cz/api/warehouses/topology
```

Deploy Catalog second:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/catalog-microservice && ./scripts/deploy.sh'
curl -sk https://catalog.alfares.cz/health
curl -sk -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" --data '{"productIds":["anonymous-protection-check"]}' https://catalog.alfares.cz/api/products/availability/coverage
```

Deploy Suppliers last. Before approved supplier stock mutation, Suppliers runtime must have `CATALOG_SERVICE_URL` and `CATALOG_SERVICE_TOKEN` or `CATALOG_INTERNAL_SERVICE_TOKEN` configured so it can verify Catalog product identity before calling Warehouse reconciliation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && ./scripts/deploy.sh'
curl -sk https://suppliers.alfares.cz/api/health
curl -sk -o /dev/null -w "%{http_code}\n" https://suppliers.alfares.cz/api/imports
```

Protected endpoint checks should return `401` or `403` without credentials.

## Approved Runtime Smoke

Pass tokens into the remote shell only for the smoke command. Do not print them. The values below must be filled by the approved operator immediately before execution.

```bash
ssh alfares '
cd /home/ssf/Documents/Github/suppliers-microservice &&
WAREHOUSE_URL=https://warehouse.alfares.cz \
CATALOG_URL=https://catalog.alfares.cz \
SUPPLIERS_URL=https://suppliers.alfares.cz \
CATALOG_TOKEN="<approved-catalog-token>" \
WAREHOUSE_TOKEN="<approved-warehouse-token>" \
SUPPLIERS_TOKEN="<approved-suppliers-token>" \
TRACE_PRODUCT_ID="<approved-synthetic-product-id>" \
TRACE_PRODUCT_SKU_PREFIX="CODEX-STOCK-TRACE-" \
TRACE_SUPPLIER_ID="<active-synthetic-trace-supplier-id>" \
TRACE_SUPPLIER_WAREHOUSE_ID="<supplier-replenishment-warehouse-id>" \
TRACE_DROPSHIP_WAREHOUSE_ID="<supplier-dropship-warehouse-id>" \
TRACE_IMPORT_IDEMPOTENCY_KEY="manual:traceability-20260613-001" \
TRACE_CLEANUP_EVIDENCE="deferred:stock-traceability-runbook-20260613" \
TRACE_RUN_SUPPLIERS_IMPORT=true \
TRACE_EXPECT_SUPPLIERS_JOB=true \
OWNER_APPROVAL=explicit \
SMOKE_ALLOW_MUTATION=true \
node reports/validation/runtime-stock-traceability-smoke.js
'
```

The smoke must return `status: "passed"` and include:

- health for Warehouse, Catalog, and Suppliers;
- Catalog product ID and SKU;
- Warehouse own and supplier-managed topology rows;
- Warehouse availability rows with own plus supplier and dropship positive availability;
- Warehouse logistics routes and route legs containing local fulfillment plus supplier replenishment and dropship;
- Catalog availability and FlipFlop projection with Warehouse source, origin rows, logistics routes, and route legs;
- Catalog coverage and audit with `covered` and `mixed_stock`;
- Suppliers import job with Catalog product identity verified before Warehouse mutation, Warehouse mutation attempted, approved, Warehouse authority, and applied updates;
- cleanup or cleanup-deferral evidence.

Save the smoke JSON to a file for report generation:

```bash
ssh alfares '
cd /home/ssf/Documents/Github/suppliers-microservice &&
WAREHOUSE_URL=https://warehouse.alfares.cz \
CATALOG_URL=https://catalog.alfares.cz \
SUPPLIERS_URL=https://suppliers.alfares.cz \
CATALOG_TOKEN="<approved-catalog-token>" \
WAREHOUSE_TOKEN="<approved-warehouse-token>" \
SUPPLIERS_TOKEN="<approved-suppliers-token>" \
TRACE_PRODUCT_ID="<approved-synthetic-product-id>" \
TRACE_PRODUCT_SKU_PREFIX="CODEX-STOCK-TRACE-" \
TRACE_SUPPLIER_ID="<active-synthetic-trace-supplier-id>" \
TRACE_SUPPLIER_WAREHOUSE_ID="<supplier-replenishment-warehouse-id>" \
TRACE_DROPSHIP_WAREHOUSE_ID="<supplier-dropship-warehouse-id>" \
TRACE_IMPORT_IDEMPOTENCY_KEY="manual:traceability-20260613-001" \
TRACE_CLEANUP_EVIDENCE="deferred:stock-traceability-runbook-20260613" \
TRACE_RUN_SUPPLIERS_IMPORT=true \
TRACE_EXPECT_SUPPLIERS_JOB=true \
OWNER_APPROVAL=explicit \
SMOKE_ALLOW_MUTATION=true \
node reports/validation/runtime-stock-traceability-smoke.js
' > /tmp/stock-traceability-smoke-result.json
```

## Failure Handling

- If Warehouse deploy or health fails, stop before Catalog and Suppliers.
- If Catalog deploy fails, stop before Suppliers and roll back Catalog only unless the owner requests wider rollback.
- If Suppliers deploy fails, do not run the approved supplier import.
- If runtime smoke fails before mutation, fix source or config and rerun from the failed step.
- If runtime smoke fails after mutation, record the failed response summary with tokens redacted, preserve the Suppliers import job ID and idempotency key, and follow the approved cleanup or deferral path.

## Completion Evidence

The guarded runner can generate and verify the final runtime report. If running the steps manually after a passing read-only fixture check and live smoke, create the final runtime validation report from `docs/cross-service/stock-traceability-runtime-evidence-template.md`. Save the filled report as `docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md` and record:

- deployed commit SHA for all three services;
- deployment result and health result for all three services;
- redacted smoke command;
- summarized smoke output;
- cleanup result or deferral reference;
- final completion audit status.

Create the deployment evidence skeleton from clean current service commit SHAs, then replace the TODO health/protected-endpoint fields after deployment. Record service-specific anonymous 401/403 evidence for Warehouse topology/logistics, Catalog availability/coverage, and Suppliers imports. The generator refuses dirty Warehouse, Catalog, or Suppliers worktrees. Regenerate this file after any Warehouse, Catalog, or Suppliers commit; stale or dirty-source deployment evidence is rejected by the guarded runner and bundle verifier:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT=/tmp/stock-traceability-deployment-evidence.template.json node reports/validation/create-deployment-evidence-template.js'
```

Use the report generator after preparing a completed deployment evidence JSON file:

```bash
scp /tmp/stock-traceability-smoke-result.json alfares:/tmp/stock-traceability-smoke-result.json
scp /tmp/stock-traceability-deployment-evidence.json alfares:/tmp/stock-traceability-deployment-evidence.json
ssh alfares '
cd /home/ssf/Documents/Github/suppliers-microservice &&
SMOKE_RESULT_FILE=/tmp/stock-traceability-smoke-result.json \
FIXTURE_CHECK_RESULT_FILE=/tmp/stock-traceability-fixture-check-result.json \
DEPLOYMENT_EVIDENCE_FILE=/tmp/stock-traceability-deployment-evidence.json \
REDACTED_FIXTURE_COMMAND="WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=<approved-synthetic-product-id> TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=<own-warehouse-id> TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id> TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id> node reports/validation/runtime-stock-traceability-smoke.js --fixture-check" \
REDACTED_SMOKE_COMMAND="WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=<approved-synthetic-product-id> TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=<active-synthetic-trace-supplier-id> TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id> TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id> TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-20260613-001 TRACE_CLEANUP_EVIDENCE=deferred:stock-traceability-runbook-20260613 TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js" \
node reports/validation/generate-runtime-evidence-report.js
'
```

Then verify the generated report before treating the goal as complete:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && node reports/validation/verify-runtime-evidence-report.js'
```

The guarded runner also writes `stock-traceability-runtime-evidence-manifest.json` in `RUNTIME_EVIDENCE_DIR` unless `RUNTIME_EVIDENCE_MANIFEST` overrides the path. Preserve it with the fixture JSON, smoke JSON, deployment evidence JSON, and final report; it records byte counts and SHA-256 hashes for the complete runtime evidence bundle. The runner verifies the manifest, verifies the bundle, and then executes `verify-stock-traceability-completion.js <report-file> <manifest-file>` before it can print `runtime-complete`. Operators can rerun `node reports/validation/verify-runtime-evidence-manifest.js <manifest-file>`, `node reports/validation/verify-runtime-evidence-bundle.js <manifest-file> <report-file>`, and the completion verifier to recheck immutable evidence. The bundle verifier also proves the fixture and smoke artifacts use the same trace product, supplier/dropship warehouse IDs, and `TRACE_SUPPLIER_ID` ownership for supplier-managed origins and routes, so operators cannot accidentally combine evidence from different runs or suppliers.


Completion gate: run `node reports/validation/verify-stock-traceability-completion.js <report-file> <manifest-file>` before claiming the stock traceability goal is complete. It returns incomplete for failed or partial runtime reports and rejects passed-runtime reports that do not have a verified evidence bundle.


Runtime handoff checklist: generate the operator handoff with `RUNTIME_HANDOFF_OUTPUT=/tmp/stock-traceability-runtime-handoff.md node reports/validation/create-runtime-handoff-checklist.js`. The checklist records current service HEADs, completion gate state, required operator inputs, ordered deployment commands, and the final completion verifier command.
