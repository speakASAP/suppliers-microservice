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
docs/12_validation/VAL-CROSS-STOCK-RUNTIME-LIVE.md
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

When using the generator, provide deployment evidence as JSON in this shape. Start from `node reports/validation/create-deployment-evidence-template.js` to capture clean current commit SHAs, the `generatedFromCurrentHeads` marker, and the completion-verifier reminder, then use `RUNTIME_READINESS_MANIFEST_FILE=<readiness-manifest>` with `create-deployment-evidence.js` after deployment so completed evidence binds to the same readiness bundle as the approval artifact. The generator refuses dirty service worktrees. The guarded runner rejects approved smoke when deployment evidence is missing that current-head marker/reminder, when any deployment commit SHA differs from the current remote repository HEAD for the matching service, or when Warehouse, Catalog, or Suppliers has uncommitted source beside the recorded deployment commit:

```json
{
  "generatedFromCurrentHeads": true,
  "readinessManifest": {
    "file": "/tmp/stock-traceability-runtime-readiness/stock-traceability-runtime-readiness-manifest.json",
    "sha256": "64-character-sha256",
    "status": "verified",
    "serviceHeads": {
      "warehouse": "40-character-git-commit-sha",
      "catalog": "40-character-git-commit-sha",
      "suppliers": "40-character-git-commit-sha"
    }
  },
  "completionReminder": "Deployment evidence is valid only when each commitSha still matches the current remote repo HEAD and verify-stock-traceability-completion.js passes against the generated runtime manifest.",
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

The generator marks the final report `Runtime incomplete` unless deployment evidence has `generatedFromCurrentHeads: true`, includes a verified readiness manifest binding shared with the approval artifact, includes the completion-verifier reminder, and all three services include a SHA-shaped commit ID, deploy command, health evidence, and anonymous protected-endpoint evidence containing `401` or `403`.

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | 7-40 hex commit SHA | `./scripts/deploy.sh` | `/api/health` passed | Anonymous protected endpoint returned `401` or `403`. |
| Catalog | 7-40 hex commit SHA | `./scripts/deploy.sh` | `/health` passed | Anonymous protected endpoint returned `401` or `403`. |
| Suppliers | 7-40 hex commit SHA | `./scripts/deploy.sh` | `/api/health` passed | Anonymous protected endpoint returned `401` or `403`. |


## Runtime Evidence Manifest

Preserve the guarded runner manifest from `RUNTIME_EVIDENCE_DIR/stock-traceability-runtime-evidence-manifest.json` or the path set by `RUNTIME_EVIDENCE_MANIFEST`. The manifest must stay with the fixture JSON, smoke JSON, deployment evidence JSON, runtime approval artifact JSON, and final report because it records byte counts and SHA-256 hashes for the runtime evidence bundle. The guarded runner verifies the manifest, verifies the bundle, and runs `verify-stock-traceability-completion.js <report-file> <manifest-file>` before it can print `runtime-complete`. The bundle verifier must reject missing artifacts, mismatched bytes, mismatched SHA-256 hashes, service heads that do not match the current deployed source repos, deployment rows in the final report that do not match the manifest-hashed deployment evidence artifact, fixture/smoke bundles where supplier-managed origins or routes are not owned by the same `TRACE_SUPPLIER_ID`, non-reservable route artifacts, and smoke artifacts where the Suppliers import job does not prove Catalog product validation, approved trace source fingerprint, and Warehouse stock authority.

## Fixture Check Command Evidence

Record the read-only fixture check command with tokens replaced by `[REDACTED]`. It must include `--fixture-check`, must not include mutation flags, and the fixture check command must use the same trace IDs as the approved smoke command for product, SKU prefix, own warehouse, supplier replenishment warehouse, and dropship warehouse. The fixture artifact must show the supplier replenishment and dropship warehouse origins are linked to the same `TRACE_SUPPLIER_ID` used by the approved smoke.

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
- `TRACE_SUPPLIER_STOCK_QTY`
- `TRACE_SUPPLIER_SKU`
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
| Warehouse availability returns own plus supplier and dropship stock. | Origin row summary with warehouse type, supplier ID matching `TRACE_SUPPLIER_ID`, and positive available values. | pending-runtime |
| Warehouse logistics returns local and supplier replenishment and dropship route options. | Route type list and route legs proving local warehouse-to-customer fulfillment plus supplier replenishment through Alfares or direct supplier dropship to customer, positive `available` values, `canReserveFromWarehouse=true`, route evidence must include warehouse and supplier identifiers, those identifiers must match the trace IDs from the redacted smoke command, and supplier routes must be owned by `TRACE_SUPPLIER_ID`. | pending-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | Source, row count, logistics option count, forwarded route types, and forwarded route legs including positive reservable local plus supplier movement. | pending-runtime |
| Catalog coverage and audit classify covered mixed stock. | `coverageStatus`, `stockOrigin`, and audit matched product. | pending-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | Source, stock quantity, route count, forwarded route types, and forwarded route legs including positive reservable local plus supplier movement. | pending-runtime |
| Suppliers import preserves Catalog identity and Warehouse authority. | Job status, idempotency key, `sourceFingerprint` matching `trace:<TRACE_PRODUCT_ID>:<TRACE_SUPPLIER_WAREHOUSE_ID>:<TRACE_DROPSHIP_WAREHOUSE_ID>:<TRACE_SUPPLIER_STOCK_QTY>:<TRACE_SUPPLIER_SKU>`, `catalogProductValidation=passed`, checked Catalog product IDs, Warehouse authority, mutation attempted, approved, and update count. | pending-runtime |
| Warehouse remains stock authority across totals. | Warehouse total, summed Warehouse origins, Catalog availability total, and Catalog coverage total all match with `source=warehouse`; FlipFlop stock quantity matches traceable reservable route availability recorded as `projectionSellableRouteAvailable`. | pending-runtime |
| Cleanup or archival evidence is recorded. | `TRACE_CLEANUP_EVIDENCE` value or completed cleanup summary. | pending-runtime |

## Smoke Output Summary

Include only summarized fields from the JSON smoke output:

- product ID and SKU;
- named health service values for `warehouse`, `catalog`, and `suppliers`;
- own and supplier-managed Warehouse origin summaries;
- Warehouse, Catalog, and FlipFlop route type and route-leg lists;
- Catalog coverage summary;
- stock-authority total consistency summary;
- Suppliers import job summary, including approved trace source fingerprint and Catalog product identity validation before Warehouse reconciliation;
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

The verifier fails if metadata is not `passed-runtime` and `runtime-complete`, if any named runtime assertion remains `missing-runtime` or `pending-runtime`, if deployment evidence rows have missing values or `TODO` placeholders, if deployment evidence is not bound to the same readiness manifest as the approval artifact, if protected endpoint evidence does not include `401` or `403`, if route evidence omits warehouse or supplier identifiers, if route evidence does not match the trace IDs from the redacted smoke command, if supplier replenishment and dropship route evidence are not owned by the same supplier ID, if the Suppliers source fingerprint does not match the redacted command product, supplier warehouse IDs, supplier stock quantity, and supplier SKU, if the redacted fixture command does not include `--fixture-check`, if the redacted fixture command does not match the smoke command trace IDs, if the redacted fixture command enables supplier import or mutation, if fixture evidence does not prove `fixture-ready`, mutation disabled, and supplier import not triggered, if the redacted smoke command does not include the approved import, expected job, own warehouse ID, owner approval, mutation allowance, cleanup, and token-redaction fields, or if the completion decision is not `Runtime complete`. The bundle verifier then cross-checks those deployment rows against the manifest-hashed deployment evidence artifact, so report text generated from different deployment evidence cannot prove completion. The guarded runner must also have accepted clean Warehouse, Catalog, and Suppliers worktrees before generating the final bundle.

The negative validation command proves unsafe evidence cannot pass:

```bash
node reports/validation/runtime-evidence-negative-check.js
```

It must fail generated runtime reports for a real/non-synthetic SKU, unnamed health evidence, missing forwarded supplier replenishment and dropship route types, missing logistics leg evidence, missing read-only fixture-check evidence, mismatched supplier job source fingerprint, mismatched stock-authority totals, invalid deployment commit evidence, missing deployment service rows, placeholder deployment health evidence, deployment evidence missing the current-head marker, protected endpoint evidence that does not contain `401` or `403`, and redacted smoke command evidence that disables the approved supplier import or omits the own warehouse ID.

## Boundary Evidence

Confirm:

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval.


Completion gate: run `node reports/validation/verify-stock-traceability-completion.js <report-file> <manifest-file>` before claiming the stock traceability goal is complete. It returns incomplete for failed or partial runtime reports and rejects passed-runtime reports that do not have a verified evidence bundle.
