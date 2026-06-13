# Cross-Service Stock Traceability Runtime Rollout

Metadata:
- id: CROSS-STOCK-TRACEABILITY-RUNTIME-ROLLOUT
- status: ready-for-owner-approval
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: executable-plan
- upstream: docs/cross-service/stock-traceability-flow.md, docs/cross-service/stock-traceability-live-runbook.md, docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-TRACEABILITY.md

## Purpose

This rollout plan defines the approval-gated runtime proof for tracing one Catalog good through Alfares-owned stock, supplier and dropship virtual stock, Warehouse logistics routes, Catalog coverage, and downstream channel projection.

## Required Source Baseline

Deploy only after the following source slices are present in the target branches or commits:

| Service | Required source slice | Runtime surface |
| --- | --- | --- |
| Warehouse | WH-G11 through WH-G15 | Origin availability rows, topology, product logistics, and `POST /api/warehouses/logistics/batch`. |
| Catalog | CAT-G10 through CAT-G13 | Origin-aware availability, logistics projection, coverage read model, and coverage audit. |
| Suppliers | SUP-G7 plus cross-service evidence | Validation-first supplier stock reconciliation client and synthetic traceability evidence. |

## Approval Boundary

Production deployment and runtime mutation require explicit owner approval in the same session. Without approval, only source validation, plan-only smoke, and read-only health/auth checks may run.

Approved mutation scope must be limited to synthetic traceability records:

- one synthetic Catalog product with a `CODEX-STOCK-TRACE-` SKU prefix;
- one existing or synthetic Alfares-owned Warehouse location;
- one existing or synthetic supplier and dropship Warehouse location;
- one synthetic Suppliers import job for a supplier whose `code` resolves to the `synthetic-trace` adapter;
- cleanup or archival instructions recorded before mutation starts.

## Deployment Order

The concrete operator command sequence is maintained in `docs/cross-service/stock-traceability-live-runbook.md`.

1. Record pre-deploy commit SHA and verify clean `git status --short` output for Warehouse, Catalog, and Suppliers; do not generate deployment evidence or run approved smoke from a dirty worktree.
2. Deploy Warehouse first so origin metadata and batch logistics are available.
3. Smoke Warehouse health and protected endpoint auth behavior.
4. Deploy Catalog second so it can consume the new Warehouse contracts.
5. Smoke Catalog health and protected endpoint auth behavior for availability, coverage, coverage audit, and FlipFlop projection.
6. Deploy Suppliers last so approved reconciliation calls target the upgraded Warehouse contract.
7. Smoke Suppliers health and protected endpoint auth behavior.
8. Run the approved cross-service runtime smoke.

## Runtime Smoke Assertions

The full requirement audit is maintained in `docs/cross-service/stock-traceability-completion-audit.md`.

When owner-approved mutation is allowed, run the smoke with a synthetic Suppliers import:

- `OWNER_APPROVAL=explicit`
- `SMOKE_ALLOW_MUTATION=true`
- `TRACE_RUN_SUPPLIERS_IMPORT=true`
- `TRACE_SUPPLIER_ID=<active supplier id>`
- `TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id>`
- `TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id>`
- `TRACE_IMPORT_IDEMPOTENCY_KEY=<stable replay key>`
- `TRACE_SUPPLIER_STOCK_QTY=<approved synthetic supplier quantity>`
- `TRACE_SUPPLIER_SKU=<approved synthetic supplier sku>`
- `TRACE_CLEANUP_EVIDENCE=<cleanup result or deferred cleanup reference>`

The approved supplier must be active and must use supplier `code` value `synthetic-trace`, which maps to the registered synthetic adapter. The smoke sends `sourceFingerprint` as `trace:<TRACE_PRODUCT_ID>:<TRACE_SUPPLIER_WAREHOUSE_ID>:<TRACE_DROPSHIP_WAREHOUSE_ID>:<TRACE_SUPPLIER_STOCK_QTY>:<TRACE_SUPPLIER_SKU>`, waits for the async import job to complete, and verifies the Warehouse policy fields before checking Catalog and Warehouse read models.

When `SMOKE_ALLOW_MUTATION=true`, `TRACE_CLEANUP_EVIDENCE` is mandatory. It may point to completed cleanup evidence or to an explicit owner-approved deferral such as `deferred:<ticket-or-runbook>`. Hard deletes or compensating stock changes remain separate approved actions.

For read-only rehearsal, keep `SMOKE_ALLOW_MUTATION` and `TRACE_RUN_SUPPLIERS_IMPORT` unset and run `node reports/validation/runtime-stock-traceability-smoke.js --plan-only`. For live fixture readiness without mutation, set service URLs, tokens, `TRACE_PRODUCT_ID`, and optional expected warehouse IDs, then run `node reports/validation/runtime-stock-traceability-smoke.js --fixture-check`. When the guarded runner is started with `RUN_APPROVED_RUNTIME_SMOKE=true`, it validates owner approval, mutation allowance, cleanup evidence, clean Warehouse/Catalog/Suppliers worktrees, and complete deployment evidence before any live fixture or import request.


The runtime smoke is complete only when current production responses prove all assertions below:

| Assertion | Evidence |
| --- | --- |
| Catalog product identity exists. | Catalog product read returns the synthetic product ID and SKU. |
| Own Warehouse stock exists. | Warehouse topology exposes own warehouses and Warehouse availability returns a row with `warehouseType: own`, positive `available`, and no supplier ID. |
| Supplier/dropship stock exists. | Warehouse topology exposes supplier-managed warehouses and availability returns a row with `warehouseType: supplier` or `dropship`, positive `available`, and supplier ID. |
| Logistics are Warehouse-owned. | Warehouse logistics returns `local_fulfillment` plus `supplier_replenishment` or `supplier_dropship` route options with route legs. |
| Catalog forwards stock origins. | Catalog availability returns `source: warehouse` and both origin rows. |
| Catalog forwards logistics. | Catalog availability or FlipFlop projection returns `availability.logistics.preferredRoute`, route options, and route legs. |
| Catalog coverage classifies the product. | Catalog coverage returns `coverageStatus: covered` and `stockOrigin: mixed_stock` for the synthetic mixed-source product. |
| Coverage audit finds active goods. | Catalog coverage audit returns the synthetic product on its page or an approved filtered page. |
| Suppliers mutation boundary is preserved. | With `TRACE_EXPECT_SUPPLIERS_JOB=true`, smoke reads Suppliers import jobs and verifies the job belongs to `TRACE_SUPPLIER_ID`, Catalog product validation passed before Warehouse mutation, checked Catalog product IDs include `TRACE_PRODUCT_ID`, the source fingerprint matches the approved trace import request, Warehouse authority is preserved, mutation was owner-approved, and applied update count is positive. |
| Warehouse remains stock authority. | No Catalog or Suppliers persistence creates independent stock truth; Warehouse availability remains the source of totals. |

## Rollback And Cleanup

- If Warehouse deployment fails, stop before deploying Catalog or Suppliers.
- If Catalog deployment fails after Warehouse succeeds, roll back Catalog only; Warehouse read contracts are additive and may remain deployed unless owner requests rollback.
- If Suppliers deployment fails after Warehouse/Catalog succeed, roll back Suppliers only; do not run supplier stock mutation smoke.
- Synthetic runtime records must be cleaned up or archived according to each service's existing hard-delete and audit rules.
- Any cleanup requiring hard delete or stock mutation needs explicit owner approval.

## Evidence To Capture

Record these artifacts after the approved runtime smoke:

- service commit SHAs and deployment image tags;
- exact smoke command with secret values redacted;
- Warehouse topology, availability, logistics route, and logistics leg response summary;
- service health summary;
- Catalog product identity summary;
- Catalog availability, coverage, coverage audit page/matched product, and FlipFlop projection summary;
- Suppliers import/reconciliation job summary with idempotency key, approved trace source fingerprint, and Warehouse policy fields;
- cleanup result or explicit reason cleanup was deferred;
- final validation report status.

## Non-Goals

- No real supplier credentials or payloads are needed for this smoke.
- No customer order, payment, or shipment is created.
- No Catalog stock persistence is introduced.
- No Suppliers stock authority is introduced.


Runtime handoff checklist: generate the operator handoff with `RUNTIME_HANDOFF_OUTPUT=/tmp/stock-traceability-runtime-handoff.md node reports/validation/create-runtime-handoff-checklist.js`. The checklist records current service HEADs, completion gate state, required operator inputs, ordered deployment commands, and the final completion verifier command.
