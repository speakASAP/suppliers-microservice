# Cross-Service Stock Traceability Completion Audit

Metadata:
- id: CROSS-STOCK-TRACEABILITY-COMPLETION-AUDIT
- status: source-complete-runtime-pending
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: partial
- upstream: docs/cross-service/stock-traceability-flow.md, docs/cross-service/stock-traceability-runtime-rollout.md

## Purpose

This audit maps the original business objective to current evidence so completion is not inferred from partial source work. The goal is complete only when every requirement below has runtime evidence from deployed services.

## Requirement Audit

| Requirement | Current evidence | Status | Remaining proof |
| --- | --- | --- | --- |
| Catalog contains the list of sellable goods. | Catalog remains product identity authority; runtime smoke runner now reads `GET /api/products/:id` and asserts ID/SKU. | source-ready | Deploy current Catalog source and run smoke against an approved synthetic product. |
| Every sellable good can be checked for mandatory Warehouse-backed stock. | Catalog CAT-G12 `POST /api/products/availability/coverage` and CAT-G13 `GET /api/products/availability/coverage/audit` classify coverage and missing stock/routes. | source-ready | Runtime smoke must show coverage/audit for the synthetic active product. |
| Local physical stock is visible. | Warehouse WH-G11 availability rows include `warehouseType`, `warehouseCode`, `warehouseName`, and `supplierId`; WH-G12 topology groups own warehouses. | source-ready | Runtime topology must show own warehouses and availability must return an `own` row with positive availability. |
| Virtual supplier/dropship stock is visible. | Warehouse supplier reconciliation and origin metadata preserve supplier/dropship rows; synthetic trace proves source contract. | source-ready | Runtime topology must show supplier-managed warehouses and availability must return supplier or dropship row with positive availability and supplier ID. |
| Suppliers can feed Warehouse stock without becoming stock authority. | SUP-G7 reconciliation client validates payloads, requires approval for mutation, records Warehouse policy fields, and calls Warehouse reconciliation only when approved. | source-ready | Runtime Suppliers import job must show approved Warehouse policy and applied update count, or an explicitly approved equivalent evidence path. |
| Warehouses list distinguishes Alfares local warehouses from supplier warehouses. | WH-G12 topology and WH-G13 admin topology classify `own`, `supplier`, `dropship`, and `other`. | source-ready | Runtime topology smoke must show both own and supplier-managed locations, and availability smoke must show stock rows for the trace product. |
| Goods can be traced from Catalog to local/supplier Warehouse origin. | Catalog CAT-G10/12 forwards Warehouse origin rows and classifies stock origin as local/supplier/dropship/mixed/out_of_stock. | source-ready | Runtime Catalog availability/coverage must show `source: warehouse`, both origin rows, and `mixed_stock` for synthetic product. |
| Logistics from supplier/local warehouse to customer are visible. | Warehouse WH-G14/15 exposes local fulfillment, supplier replenishment, and supplier dropship routes; Catalog CAT-G11 forwards logistics. | source-ready | Runtime Warehouse/Catalog/FlipFlop responses must include local plus supplier route options. |
| Downstream channel projection can consume the same truth. | Catalog FlipFlop projection forwards `availability.warehouses[]`, `availability.logistics`, and `stockQuantity` as Warehouse `totalAvailable`. | source-ready | Runtime FlipFlop projection smoke must return Warehouse-sourced availability and logistics. |
| Warehouse remains stock and logistics authority. | Source contracts avoid Catalog stock persistence and Suppliers stock authority; smoke runner asserts Warehouse source fields and optional Suppliers job policy. | source-ready | Runtime evidence must show totals and logistics come from Warehouse, not copied stock truth in Catalog or Suppliers. |
| Production deployment is safe and ordered. | Runtime rollout plan defines deploy order, mutation boundary, rollback, cleanup, and evidence capture. | plan-ready | Owner approval, deployment, and live smoke execution are still required. |

## Completion Decision

Current status is **not complete**. Source and plan evidence are strong enough to proceed to owner-approved deployment, but the full objective requires runtime evidence from the deployed Warehouse, Catalog, and Suppliers services.

## Evidence That Would Complete The Goal

The goal can be marked complete only after the runtime smoke report proves:

1. Warehouse, Catalog, and Suppliers health endpoints pass on deployed services.
2. Catalog product identity exists for the approved trace product.
3. Warehouse topology distinguishes own and supplier-managed warehouses, and availability returns positive own stock plus positive supplier/dropship stock for that product.
4. Warehouse logistics returns local and supplier route options.
5. Catalog availability forwards both Warehouse origin rows and Warehouse logistics.
6. Catalog coverage and coverage audit classify the product as `covered` and `mixed_stock`.
7. FlipFlop projection forwards Warehouse-sourced availability and logistics.
8. Suppliers import/reconciliation evidence preserves Warehouse authority when supplier stock mutation is used.
9. Cleanup or archival evidence is recorded for synthetic records.

## Non-Completion Evidence

The following are not sufficient by themselves:

- unit tests without deployed service calls;
- synthetic source-only trace scripts;
- plan-only smoke output;
- successful deployment without cross-service smoke;
- Warehouse-only, Catalog-only, or Suppliers-only checks.
