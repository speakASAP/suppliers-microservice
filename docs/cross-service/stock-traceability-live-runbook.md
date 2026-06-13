# Cross-Service Stock Traceability Live Runbook

Metadata:
- id: CROSS-STOCK-TRACEABILITY-LIVE-RUNBOOK
- status: ready-for-owner-approval
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- upstream: docs/cross-service/stock-traceability-runtime-rollout.md, reports/validation/runtime-stock-traceability-smoke.js

## Purpose

This runbook gives the concrete owner-approved deployment and smoke commands for proving one Catalog good can be traced through Alfares-owned Warehouse stock, supplier or dropship Warehouse stock, Warehouse logistics routes, Catalog coverage, and Suppliers import evidence.

## Approval Gate

Stop unless the owner explicitly approves all three actions in the current session:

1. Deploy Warehouse, Catalog, and Suppliers source currently present on `alfares`.
2. Create or reuse synthetic traceability records only.
3. Run one approved Suppliers synthetic import that mutates Warehouse supplier or dropship stock.

Do not paste real JWTs, service tokens, supplier credentials, raw supplier payloads, customer data, or production stock response bodies into docs or chat. Keep token values in shell environment only.

## Required Inputs

Prepare these values before deploying:

| Variable | Meaning |
| --- | --- |
| `TRACE_PRODUCT_ID` | Approved synthetic Catalog product ID with a `CODEX-STOCK-TRACE-` SKU prefix. |
| `TRACE_SUPPLIER_ID` | Active Suppliers supplier ID whose code is `synthetic-trace`. |
| `TRACE_SUPPLIER_WAREHOUSE_ID` | Warehouse supplier or dropship location linked to `TRACE_SUPPLIER_ID`. |
| `TRACE_IMPORT_IDEMPOTENCY_KEY` | Stable replay key for this approved smoke, for example `manual:traceability-20260613-001`. |
| `TRACE_CLEANUP_EVIDENCE` | Completed cleanup evidence or explicit deferral reference, for example `deferred:stock-traceability-runbook-20260613`. |
| `CATALOG_TOKEN` | Approved Catalog bearer token with read access to protected Catalog endpoints. |
| `WAREHOUSE_TOKEN` | Approved Warehouse bearer token with read access and supplier reconciliation permission. |
| `SUPPLIERS_TOKEN` | Approved Suppliers bearer token with import-job access. |

## Pre-Deploy Snapshot

Run the cross-service preflight from the operator workstation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && node reports/validation/cross-service-preflight-check.js'
```

Also capture the raw git snapshot:

```bash
ssh alfares 'for r in warehouse-microservice catalog-microservice suppliers-microservice; do cd /home/ssf/Documents/Github/$r && printf "\n== %s ==\n" "$r" && git rev-parse HEAD && git status --short; done'
```

If the dirty state contains work outside the approved traceability source slices, stop and review before deploying.

## Source Validation

Run the last non-mutating validation before deployment:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/warehouse-microservice && npm test -- --runInBand && npm run build && git diff --check'
ssh alfares 'cd /home/ssf/Documents/Github/catalog-microservice && npm test -- --runInBand && npm run build && git diff --check'
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && npm run build && node reports/validation/cross-service-preflight-check.js && WAREHOUSE_URL=http://warehouse.example.test CATALOG_URL=http://catalog.example.test SUPPLIERS_URL=http://suppliers.example.test CATALOG_TOKEN=catalog-token-synthetic WAREHOUSE_TOKEN=warehouse-token-synthetic SUPPLIERS_TOKEN=suppliers-token-synthetic TRACE_PRODUCT_ID=product-synthetic TRACE_SUPPLIER_ID=11111111-1111-4111-8111-111111111111 TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true TRACE_RUN_SUPPLIERS_IMPORT=true node reports/validation/runtime-stock-traceability-smoke.js --config-only && node reports/validation/generate-runtime-evidence-report.js --self-test && node reports/validation/verify-runtime-evidence-report.js --self-test && node reports/validation/synthetic-approved-import-run-check.js && node reports/validation/production-rest-json-adapter-check.js && node reports/validation/synthetic-production-rest-json-adapter-check.js && node reports/validation/synthetic-stock-traceability-check.js && node reports/validation/runtime-stock-traceability-smoke.js --plan-only && python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues && python3 scripts/deployment_readiness_gate.py --root . && git diff --check'
```

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

Deploy Suppliers last:

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
TRACE_SUPPLIER_ID="<active-synthetic-trace-supplier-id>" \
TRACE_SUPPLIER_WAREHOUSE_ID="<supplier-or-dropship-warehouse-id>" \
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
- Warehouse availability rows with own plus supplier or dropship positive availability;
- Warehouse logistics routes containing local fulfillment plus supplier replenishment or dropship;
- Catalog availability and FlipFlop projection with Warehouse source, origin rows, and logistics;
- Catalog coverage and audit with `covered` and `mixed_stock`;
- Suppliers import job with Warehouse mutation attempted, approved, Warehouse authority, and applied updates;
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
TRACE_SUPPLIER_ID="<active-synthetic-trace-supplier-id>" \
TRACE_SUPPLIER_WAREHOUSE_ID="<supplier-or-dropship-warehouse-id>" \
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

After a passing live smoke, create the final runtime validation report from `docs/cross-service/stock-traceability-runtime-evidence-template.md`. Save the filled report as `docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md` and record:

- deployed commit SHA for all three services;
- deployment result and health result for all three services;
- redacted smoke command;
- summarized smoke output;
- cleanup result or deferral reference;
- final completion audit status.

Use the report generator after preparing a small deployment evidence JSON file:

```bash
scp /tmp/stock-traceability-smoke-result.json alfares:/tmp/stock-traceability-smoke-result.json
scp /tmp/stock-traceability-deployment-evidence.json alfares:/tmp/stock-traceability-deployment-evidence.json
ssh alfares '
cd /home/ssf/Documents/Github/suppliers-microservice &&
SMOKE_RESULT_FILE=/tmp/stock-traceability-smoke-result.json \
DEPLOYMENT_EVIDENCE_FILE=/tmp/stock-traceability-deployment-evidence.json \
REDACTED_SMOKE_COMMAND="WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js" \
node reports/validation/generate-runtime-evidence-report.js
'
```

Then verify the generated report before treating the goal as complete:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && node reports/validation/verify-runtime-evidence-report.js'
```
