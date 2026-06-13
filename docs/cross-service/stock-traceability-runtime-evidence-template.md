# Cross-Service Stock Traceability Runtime Evidence Template

Metadata:
- id: CROSS-STOCK-TRACEABILITY-RUNTIME-EVIDENCE-TEMPLATE
- status: template-ready
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- upstream: docs/cross-service/stock-traceability-live-runbook.md, reports/validation/runtime-stock-traceability-smoke.js

## Purpose

Use this template after an owner-approved live run to create the final runtime evidence report. Keep secrets, bearer tokens, raw production payloads, customer data, supplier credentials, and unredacted response bodies out of the report.

## Report Location

Create the final report as:

```text
docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md
```

The report can be generated from saved smoke output with `reports/validation/generate-runtime-evidence-report.js`. After generation, validate it with `reports/validation/verify-runtime-evidence-report.js`.

## Required Metadata

```text
# VAL-CROSS-STOCK-RUNTIME-LIVE - Cross-Service Runtime Traceability Validation

Metadata:
- id: VAL-CROSS-STOCK-RUNTIME-LIVE
- status: passed-runtime
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: runtime-complete
- upstream: docs/cross-service/stock-traceability-live-runbook.md, docs/cross-service/stock-traceability-completion-audit.md, reports/validation/runtime-stock-traceability-smoke.js
```

If the live run fails, use `status: failed-runtime`, keep `completeness_level: partial`, and record failure handling evidence instead of marking the goal complete.

## Deployment Evidence

When using the generator, provide deployment evidence as JSON in this shape. Start from `node reports/validation/create-deployment-evidence-template.js` to capture current commit SHAs, then replace all TODO evidence fields after deployment. The guarded runner rejects approved smoke when any deployment commit SHA differs from the current remote repository HEAD for the matching service:

```json
{
  "services": {
    "warehouse": {
      "commitSha": "40-character-git-commit-sha",
      "healthEvidence": "/api/health passed",
      "protectedEndpointEvidence": "anonymous topology returned 401"
    },
    "catalog": {
      "commitSha": "40-character-git-commit-sha",
      "healthEvidence": "/health passed",
      "protectedEndpointEvidence": "anonymous coverage returned 401"
    },
    "suppliers": {
      "commitSha": "40-character-git-commit-sha",
      "healthEvidence": "/api/health passed",
      "protectedEndpointEvidence": "anonymous imports returned 401"
    }
  }
}
```

Capture `node reports/validation/cross-service-preflight-check.js` output before deployment and preserve it with the final report artifacts. Prefer `node reports/validation/run-runtime-evidence-flow.js` for live evidence capture because it runs fixture check before approved smoke and wires fixture/smoke JSON into the report generator. It records branch/head and dirty-line counts for Warehouse, Catalog, and Suppliers plus required source-surface checks.

The generator marks the final report `Runtime incomplete` unless all three services include a SHA-shaped commit ID, deploy command, health evidence, and anonymous protected-endpoint evidence containing `401` or `403`.

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | 7-40 hex commit SHA | `./scripts/deploy.sh` | `/api/health` passed | Anonymous protected endpoint returned `401` or `403`. |
| Catalog | 7-40 hex commit SHA | `./scripts/deploy.sh` | `/health` passed | Anonymous protected endpoint returned `401` or `403`. |
| Suppliers | 7-40 hex commit SHA | `./scripts/deploy.sh` | `/api/health` passed | Anonymous protected endpoint returned `401` or `403`. |


## Runtime Evidence Manifest

Preserve the guarded runner manifest from `RUNTIME_EVIDENCE_DIR/stock-traceability-runtime-evidence-manifest.json` or the path set by `RUNTIME_EVIDENCE_MANIFEST`. The manifest must stay with the fixture JSON, smoke JSON, deployment evidence JSON, and final report because it records byte counts and SHA-256 hashes for the runtime evidence bundle. Verify it with `node reports/validation/verify-runtime-evidence-manifest.js <manifest-file>` and then `node reports/validation/verify-runtime-evidence-bundle.js <manifest-file> <report-file>`; the verifier must reject missing artifacts, mismatched bytes, mismatched SHA-256 hashes, and service heads that do not match the current deployed source repos.

## Fixture Check Command Evidence

Record the read-only fixture check command with tokens replaced by `[REDACTED]`. It must include `--fixture-check`, must not include mutation flags, and must identify own, supplier replenishment, and dropship warehouse IDs.

```bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=<approved-synthetic-product-id> TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=<own-warehouse-id> TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id> TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id> node reports/validation/runtime-stock-traceability-smoke.js --fixture-check
```

## Smoke Command Evidence

Record the command with tokens replaced by `[REDACTED]`. Keep these fields visible:

- `WAREHOUSE_URL`
- `CATALOG_URL`
- `SUPPLIERS_URL`
- `TRACE_PRODUCT_ID`
- `TRACE_PRODUCT_SKU_PREFIX`
- `TRACE_SUPPLIER_ID`
- `TRACE_SUPPLIER_WAREHOUSE_ID`
- `TRACE_DROPSHIP_WAREHOUSE_ID`
- `TRACE_IMPORT_IDEMPOTENCY_KEY`
- `TRACE_CLEANUP_EVIDENCE`
- `TRACE_RUN_SUPPLIERS_IMPORT`
- `TRACE_EXPECT_SUPPLIERS_JOB`
- `OWNER_APPROVAL`
- `SMOKE_ALLOW_MUTATION`

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Read-only live fixture check passed before mutation. | Fixture smoke status, fixtureCheck flag, mutation disabled, supplier import not triggered, three warehouse IDs, and route types. | pending-runtime |
| Warehouse, Catalog, and Suppliers health endpoints passed. | Summarize named `warehouse`, `catalog`, and `suppliers` health fields only. | pending-runtime |
| Catalog product identity exists. | Product ID, SKU, and expected synthetic SKU prefix. | pending-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | Own and supplier-managed warehouse IDs/codes and positive availability totals. | pending-runtime |
| Warehouse availability returns own plus supplier and dropship stock. | Origin row summary with warehouse type, supplier ID presence, and positive available values. | pending-runtime |
| Warehouse logistics returns local and supplier replenishment and dropship route options. | Route type list and route legs proving local warehouse-to-customer fulfillment plus supplier replenishment through Alfares or direct supplier dropship to customer. | pending-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | Source, row count, logistics option count, forwarded route types, and forwarded route legs including local plus supplier movement. | pending-runtime |
| Catalog coverage and audit classify covered mixed stock. | `coverageStatus`, `stockOrigin`, and audit matched product. | pending-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | Source, stock quantity, route count, forwarded route types, and forwarded route legs including local plus supplier movement. | pending-runtime |
| Suppliers import preserves Warehouse authority. | Job status, idempotency key, Warehouse authority, mutation attempted, approved, and update count. | pending-runtime |
| Warehouse remains stock authority across totals. | Warehouse total, summed Warehouse origins, Catalog availability total, Catalog coverage total, and FlipFlop stock quantity all match with `source=warehouse`. | pending-runtime |
| Cleanup or archival evidence is recorded. | `TRACE_CLEANUP_EVIDENCE` value or completed cleanup summary. | pending-runtime |

## Smoke Output Summary

Include only summarized fields from the JSON smoke output:

- product ID and SKU;
- named health service values for `warehouse`, `catalog`, and `suppliers`;
- own and supplier-managed Warehouse origin summaries;
- Warehouse, Catalog, and FlipFlop route type and route-leg lists;
- Catalog coverage summary;
- stock-authority total consistency summary;
- Suppliers import job summary;
- cleanup evidence.

Do not paste raw full responses or tokens.

## Completion Decision

Use one of these exact decisions:

- `Runtime complete`: all assertions passed and cleanup or deferral evidence is recorded.
- `Runtime incomplete`: one or more assertions failed, were skipped, or only have indirect evidence.

Only `Runtime complete` can support marking the full goal complete.

## Verification

Run this command after generating the final report:

```bash
node reports/validation/verify-runtime-evidence-report.js
```

The verifier fails if metadata is not `passed-runtime` and `runtime-complete`, if any named runtime assertion remains `missing-runtime` or `pending-runtime`, if deployment evidence rows have missing values or `TODO` placeholders, if protected endpoint evidence does not include `401` or `403`, if the redacted fixture command does not include `--fixture-check`, if fixture evidence does not prove `fixture-ready`, mutation disabled, and supplier import not triggered, if the redacted smoke command does not include the approved import, expected job, owner approval, mutation allowance, cleanup, and token-redaction fields, or if the completion decision is not `Runtime complete`.

The negative validation command proves unsafe evidence cannot pass:

```bash
node reports/validation/runtime-evidence-negative-check.js
```

It must fail generated runtime reports for a real/non-synthetic SKU, unnamed health evidence, missing forwarded supplier replenishment and dropship route types, missing logistics leg evidence, missing read-only fixture-check evidence, mismatched stock-authority totals, invalid deployment commit evidence, missing deployment service rows, placeholder deployment health evidence, protected endpoint evidence that does not contain `401` or `403`, and redacted smoke command evidence that disables the approved supplier import.

## Boundary Evidence

Confirm:

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval.


Completion gate: run `node reports/validation/verify-stock-traceability-completion.js <report-file> <manifest-file>` before claiming the stock traceability goal is complete. It returns incomplete for failed or partial runtime reports and rejects passed-runtime reports that do not have a verified evidence bundle.
