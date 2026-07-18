# Cross-Service Stock Traceability Completion Audit

Metadata:
- id: CROSS-STOCK-TRACEABILITY-COMPLETION-AUDIT
- status: source-complete-runtime-pending
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: partial
- upstream: docs/cross-service/stock-traceability-flow.md, docs/cross-service/stock-traceability-runtime-rollout.md, docs/cross-service/stock-traceability-runtime-evidence-template.md

## Purpose

This audit maps the original business objective to current evidence so completion is not inferred from partial source work. The goal is complete only when every requirement below has runtime evidence from deployed services.

## Requirement Audit

| Requirement | Current evidence | Status | Remaining proof |
| --- | --- | --- | --- |
| Catalog contains the list of sellable goods. | Catalog remains product identity authority; runtime smoke runner now reads `GET /api/products/:id` and asserts ID/SKU. | source-ready | Deploy current Catalog source and run smoke against an approved synthetic product. |
| Every sellable good can be checked for mandatory Warehouse-backed stock. | Catalog CAT-G12 `POST /api/products/availability/coverage` and CAT-G13 `GET /api/products/availability/coverage/audit` classify coverage and missing stock/routes. | source-ready | Runtime smoke must show coverage/audit for the synthetic active product. |
| Local physical stock is visible. | Warehouse WH-G11 availability rows include `warehouseType`, `warehouseCode`, `warehouseName`, and `supplierId`; WH-G12 topology groups own warehouses. | source-ready | Runtime topology must show own warehouses and availability must return an `own` row with positive availability. |
| Virtual supplier and dropship stock is visible. | Warehouse supplier reconciliation and origin metadata preserve supplier and dropship rows; synthetic trace proves source contract. | source-ready | Runtime topology must show supplier-managed warehouses and availability must return supplier and dropship rows with positive availability whose supplier IDs match `TRACE_SUPPLIER_ID`. |
| Suppliers can feed Warehouse stock without becoming stock authority. | SUP-G7 reconciliation client validates payloads, stamps stock candidates with the import supplier ID, rejects supplier identity drift before Warehouse mutation, requires approval for mutation, verifies Catalog product identity before approved Warehouse reconciliation, persists Catalog validation status and checked product IDs, records Warehouse policy fields, calls Warehouse reconciliation only when approved, and has a `synthetic-trace` adapter for approved smoke imports. | source-ready | Runtime Suppliers import job must belong to `TRACE_SUPPLIER_ID`, show `catalogProductValidation=passed`, checked Catalog product IDs including `TRACE_PRODUCT_ID`, source fingerprint matching the approved trace import request and the redacted smoke command product, supplier warehouse IDs, supplier stock quantity, and supplier SKU, approved Warehouse policy, Warehouse authority, and positive applied update count through the registered synthetic adapter. |
| Warehouses list distinguishes Alfares local warehouses from supplier warehouses. | WH-G12 topology and WH-G13 admin topology classify `own`, `supplier`, `dropship`, and `other`. | source-ready | Runtime topology smoke must show both own and supplier-managed locations, and availability smoke must show stock rows for the trace product. |
| Goods can be traced from Catalog to local/supplier Warehouse origin. | Catalog CAT-G10/12 forwards Warehouse origin rows and classifies stock origin as local/supplier and dropship/mixed/out_of_stock. | source-ready | Runtime Catalog availability/coverage must show `source: warehouse`, both origin rows, and `mixed_stock` for synthetic product. |
| Logistics from supplier/local warehouse to customer are visible. | Warehouse WH-G14/15 exposes local fulfillment, supplier replenishment, and supplier dropship routes with legs; Catalog CAT-G11 forwards logistics. | source-ready | Runtime Warehouse/Catalog/FlipFlop responses must include local plus supplier replenishment and dropship route options and route legs proving warehouse-to-customer plus supplier-to-Alfares and supplier-to-customer movement. The final report must show route warehouse IDs matching the redacted smoke command trace IDs and supplier route evidence owned by the same `TRACE_SUPPLIER_ID`. |
| Downstream channel projection can consume the same truth. | Catalog FlipFlop projection forwards `availability.warehouses[]` and `availability.logistics`; `stockQuantity` is a sellable compatibility value derived from traceable reservable Warehouse route availability, while raw Warehouse totals remain under `availability`. | source-ready | Runtime FlipFlop projection smoke must return Warehouse-sourced availability and logistics, and prove `stockQuantity` matches traceable reservable route availability. |
| Warehouse remains stock and logistics authority. | Source contracts avoid Catalog stock persistence and Suppliers stock authority; smoke runner asserts Warehouse source fields and optional Suppliers job policy. | source-ready | Runtime evidence must show totals and logistics come from Warehouse, not copied stock truth in Catalog or Suppliers. |
| Production deployment is safe and ordered. | Runtime rollout plan defines deploy order, mutation boundary, rollback, cleanup, evidence capture, current-head deployment evidence, and clean Warehouse/Catalog/Suppliers worktree gates. Runtime smoke now requires `TRACE_CLEANUP_EVIDENCE` whenever approved mutation is enabled. | plan-ready | Owner approval, clean current-head deployment evidence, deployment, and live smoke execution are still required. |

## Completion Decision

Current status is **not complete**. Source and plan evidence are strong enough to proceed to owner-approved deployment, but the full objective requires a passing read-only fixture check plus runtime evidence from the deployed Warehouse, Catalog, and Suppliers services. The final runtime evidence must be recorded in `docs/12_validation/VAL-CROSS-STOCK-RUNTIME-LIVE.md` using `docs/cross-service/stock-traceability-runtime-evidence-template.md`, with deployment evidence generated from clean current service heads. The read-only fixture command and approved smoke command must use the same trace product, SKU prefix, own warehouse, supplier replenishment warehouse, and dropship warehouse IDs.

## Evidence That Would Complete The Goal

The goal can be marked complete only after the runtime smoke report proves:

1. Warehouse, Catalog, and Suppliers health endpoints pass on deployed services.
2. Catalog product identity exists for the approved trace product.
3. Warehouse topology distinguishes own and supplier-managed warehouses, and availability returns positive own stock plus positive supplier and dropship stock for that product with supplier-managed origins owned by `TRACE_SUPPLIER_ID`.
4. Warehouse logistics returns local and supplier replenishment and dropship route options with route legs proving local warehouse-to-customer and supplier-to-Alfares and supplier-to-customer movement, positive availability, `canReserveFromWarehouse=true`, route warehouse IDs matching the redacted smoke command trace IDs, and supplier routes are owned by `TRACE_SUPPLIER_ID`.
5. Catalog availability forwards both Warehouse origin rows and Warehouse logistics, including route legs, positive availability, and reservability.
6. Catalog coverage and coverage audit classify the product as `covered` and `mixed_stock`.
7. FlipFlop projection forwards Warehouse-sourced availability and logistics, including route legs, positive availability, and reservability.
8. Suppliers import evidence preserves Catalog product identity, supplier identity, and Warehouse authority through an approved `synthetic-trace` import when supplier stock mutation is used: the job belongs to `TRACE_SUPPLIER_ID`, `catalogProductValidation=passed`, checked Catalog product IDs include `TRACE_PRODUCT_ID`, the job `sourceFingerprint` matches the approved trace import request and redacted command trace product, supplier warehouse IDs, supplier stock quantity, and supplier SKU, Warehouse authority is recorded, mutation is approved, and applied update count is positive.
9. Warehouse total availability, summed Warehouse origins, Catalog availability total, and Catalog coverage total all match with Warehouse as source; FlipFlop stock quantity matches traceable reservable Warehouse route availability and may be lower than raw Warehouse totals when diagnostics include non-reservable stock.
10. Cleanup or archival evidence is recorded for synthetic records through `TRACE_CLEANUP_EVIDENCE`.
11. Deployment evidence was generated from clean current Warehouse, Catalog, and Suppliers heads, and the guarded runner accepted clean worktrees before the runtime bundle was generated.

## Non-Completion Evidence

The following are not sufficient by themselves:

- unit tests without deployed service calls;
- synthetic source-only trace scripts;
- plan-only smoke output;
- successful deployment without cross-service smoke;
- Warehouse-only, Catalog-only, or Suppliers-only checks;
- runtime evidence generated while any service worktree has uncommitted source beside the recorded deployment commit.


Completion gate: run `node reports/validation/verify-stock-traceability-completion.js <report-file> <manifest-file>` before claiming the stock traceability goal is complete. It returns incomplete for failed or partial runtime reports and rejects passed-runtime reports that do not have a verified evidence bundle. The bundle must include deployment evidence generated from clean current service heads with `generatedFromCurrentHeads: true`, the completion-verifier reminder, no dirty Warehouse/Catalog/Suppliers worktree state at runtime evidence generation, and a passing bundle verifier that rechecks clean current service worktrees.


Runtime handoff checklist: generate the operator handoff with `RUNTIME_HANDOFF_OUTPUT=/tmp/stock-traceability-runtime-handoff.md node reports/validation/create-runtime-handoff-checklist.js`. The checklist records current service HEADs, completion gate state, required operator inputs, ordered deployment commands, and the final completion verifier command.
