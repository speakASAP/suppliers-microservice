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

When using the generator, provide deployment evidence as JSON in this shape:

```json
{
  "services": {
    "warehouse": {
      "commitSha": "sha",
      "healthEvidence": "/api/health passed",
      "protectedEndpointEvidence": "anonymous topology returned 401"
    },
    "catalog": {
      "commitSha": "sha",
      "healthEvidence": "/health passed",
      "protectedEndpointEvidence": "anonymous coverage returned 401"
    },
    "suppliers": {
      "commitSha": "sha",
      "healthEvidence": "/api/health passed",
      "protectedEndpointEvidence": "anonymous imports returned 401"
    }
  }
}
```

Capture `node reports/validation/cross-service-preflight-check.js` output before deployment and preserve it with the final report artifacts. It records branch/head and dirty-line counts for Warehouse, Catalog, and Suppliers plus required source-surface checks.

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | redacted-or-sha | `./scripts/deploy.sh` | `/api/health` passed | Anonymous protected endpoint returned `401` or `403`. |
| Catalog | redacted-or-sha | `./scripts/deploy.sh` | `/health` passed | Anonymous protected endpoint returned `401` or `403`. |
| Suppliers | redacted-or-sha | `./scripts/deploy.sh` | `/api/health` passed | Anonymous protected endpoint returned `401` or `403`. |

## Smoke Command Evidence

Record the command with tokens replaced by `[REDACTED]`. Keep these fields visible:

- `WAREHOUSE_URL`
- `CATALOG_URL`
- `SUPPLIERS_URL`
- `TRACE_PRODUCT_ID`
- `TRACE_SUPPLIER_ID`
- `TRACE_SUPPLIER_WAREHOUSE_ID`
- `TRACE_IMPORT_IDEMPOTENCY_KEY`
- `TRACE_CLEANUP_EVIDENCE`
- `TRACE_RUN_SUPPLIERS_IMPORT`
- `TRACE_EXPECT_SUPPLIERS_JOB`
- `OWNER_APPROVAL`
- `SMOKE_ALLOW_MUTATION`

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Warehouse, Catalog, and Suppliers health endpoints passed. | Summarize health fields only. | pending-runtime |
| Catalog product identity exists. | Product ID and SKU only. | pending-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | Own and supplier-managed warehouse IDs/codes and positive availability totals. | pending-runtime |
| Warehouse availability returns own plus supplier or dropship stock. | Origin row summary with warehouse type, supplier ID presence, and positive available values. | pending-runtime |
| Warehouse logistics returns local and supplier route options. | Route type list only. | pending-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | Source, row count, and logistics option count. | pending-runtime |
| Catalog coverage and audit classify covered mixed stock. | `coverageStatus`, `stockOrigin`, and audit matched product. | pending-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | Source, stock quantity, and route count. | pending-runtime |
| Suppliers import preserves Warehouse authority. | Job status, idempotency key, Warehouse authority, mutation attempted, approved, and update count. | pending-runtime |
| Cleanup or archival evidence is recorded. | `TRACE_CLEANUP_EVIDENCE` value or completed cleanup summary. | pending-runtime |

## Smoke Output Summary

Include only summarized fields from the JSON smoke output:

- product ID and SKU;
- health service names and pass/fail status;
- own and supplier-managed Warehouse origin summaries;
- route type list;
- Catalog coverage summary;
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

The verifier fails if metadata is not `passed-runtime` and `runtime-complete`, if any runtime assertion remains `missing-runtime` or `pending-runtime`, if deployment evidence rows have missing values, or if the completion decision is not `Runtime complete`.

## Boundary Evidence

Confirm:

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval.
