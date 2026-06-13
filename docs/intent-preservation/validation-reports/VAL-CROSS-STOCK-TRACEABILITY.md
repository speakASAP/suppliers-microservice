# VAL-CROSS-STOCK-TRACEABILITY - Cross-Service Stock Traceability Validation

Metadata:
- id: VAL-CROSS-STOCK-TRACEABILITY
- status: passed-source
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: complete
- upstream: docs/cross-service/stock-traceability-flow.md, docs/intent-preservation/validation-reports/VAL-SUP-G7.md, warehouse WH-G15 validation, catalog CAT-G11 validation, catalog CAT-G12 validation

## Artifact Validated

Source-level cross-service traceability path from Suppliers normalized stock candidate to Warehouse supplier and dropship reconciliation, Warehouse origin availability, Warehouse logistics route planning, Catalog stock coverage classification, and Catalog/FlipFlop projection.

## Evidence

| Command | Status | Notes |
| --- | --- | --- |
| node reports/validation/synthetic-stock-traceability-check.js | passed | Synthetic product preserved own, supplier, and dropship origin rows, Warehouse-owned logistics routes and route legs, and Catalog coverage classification through expected source-level contract. |

## Evidence Summary

The synthetic check produced one Catalog product ID and SKU, one idempotency-derived supplier import externalReference, one own stock row, one supplier warehouse stock row, and one dropship supplier stock row. The final projection preserved all origin rows under Warehouse-sourced availability, preserved Warehouse-owned logistics routes and route legs under availability.logistics, kept FlipFlop stockQuantity equal to traceable reservable route availability while raw Warehouse totals stayed under availability, and the Catalog coverage read model classified the product as covered mixed_stock with local, supplier, and dropship availability totals intact.

## Boundary Evidence

No production stock, real supplier payload, credential, customer data, Catalog write, Warehouse mutation, deployment, or external API call was used. The check is source-level synthetic evidence only.

## Remaining Runtime Evidence

Full end-to-end completion still requires owner-approved deployment and runtime smoke. The runtime rollout plan is captured in `docs/cross-service/stock-traceability-runtime-rollout.md` and the smoke runner is `reports/validation/runtime-stock-traceability-smoke.js`:

- deploy Warehouse WH-G11, Catalog CAT-G10, and Suppliers SUP-G7;
- create or use approved synthetic Catalog product and Warehouse locations;
- run approved Suppliers reconciliation for supplier/dropship stock;
- verify Catalog availability/projection returns own and supplier-origin rows plus Warehouse-owned logistics routes and route legs;
- verify Catalog coverage returns covered/mixed_stock for the synthetic mixed source product and blocking diagnostics for missing stock/routes;
- verify downstream order/reservation flow uses Warehouse as stock and logistics authority.
