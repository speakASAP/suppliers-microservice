# VAL-CROSS-STOCK-RUNTIME-LIVE - Cross-Service Runtime Traceability Validation

Metadata:
- id: VAL-CROSS-STOCK-RUNTIME-LIVE
- status: passed-runtime
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: runtime-complete
- upstream: docs/cross-service/stock-traceability-live-runbook.md, docs/cross-service/stock-traceability-completion-audit.md, reports/validation/runtime-stock-traceability-smoke.js

## Artifact Validated

Owner-approved deployed Warehouse, Catalog, and Suppliers runtime traceability path for one synthetic Catalog good.

## Deployment Evidence

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | a99e270b2cf3f66b96b54b08e6260e42fda83bfb | ./scripts/deploy.sh | https://warehouse.alfares.cz/api/health returned 200 | anonymous /api/warehouses/topology returned 401 |
| Catalog | 314d440a53fba90d6cf72fb83c16ca005de4475e | ./scripts/deploy.sh | https://catalog.alfares.cz/health returned 200 | anonymous /api/products/availability/coverage returned 401 |
| Suppliers | 9bf0fe4637db8c2c6b680a11c9c51b139ba4a0ee | ./scripts/deploy.sh plus smoke-only WAREHOUSE_SERVICE_TOKEN env rollout | https://suppliers.alfares.cz/api/health returned 200 | anonymous /api/imports returned 401 |

## Smoke Command Evidence

```bash
SMOKE_TIMEOUT_MS=30000 WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=c0de0000-0000-4000-8000-000000000001 TRACE_SUPPLIER_ID=c0de0000-0000-4000-8000-000000000002 TRACE_SUPPLIER_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000004 TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-20260613-003 TRACE_RUN_SUPPLIERS_IMPORT=false TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js
```

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Warehouse, Catalog, and Suppliers health endpoints passed. | warehouse: healthy; catalog: healthy; suppliers: healthy | passed-runtime |
| Catalog product identity exists. | productId=c0de0000-0000-4000-8000-000000000001, sku=CODEX-STOCK-TRACE-001, expectedSkuPrefix=CODEX-STOCK-TRACE- | passed-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | own=2, supplierManaged=1, totalAvailable=11 | passed-runtime |
| Warehouse availability returns own plus supplier or dropship stock. | own:c0de0000-0000-4000-8000-000000000003:available=4:supplier=-; dropship:c0de0000-0000-4000-8000-000000000004:available=7:supplier=c0de0000-0000-4000-8000-000000000002 | passed-runtime |
| Warehouse logistics returns local and supplier route options. | routes=local_fulfillment,supplier_dropship | passed-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | source=warehouse, warehouseCount=2, logisticsOptionCount=2, preferredRoute=local_fulfillment, routeTypes=local_fulfillment,supplier_dropship | passed-runtime |
| Catalog coverage and audit classify covered mixed stock. | coverage=covered, origin=mixed_stock, audit=covered/mixed_stock | passed-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | productId=c0de0000-0000-4000-8000-000000000001, source=warehouse, stockQuantity=11, routeCount=2, routeTypes=local_fulfillment,supplier_dropship | passed-runtime |
| Suppliers import preserves Warehouse authority. | status=completed, idempotencyKey=manual:traceability-20260613-003, authority=warehouse-microservice, attempted=yes, approved=yes, updatedProducts=1 | passed-runtime |
| Warehouse remains stock authority across totals. | source=warehouse, warehouseTotalAvailable=11, warehouseOriginAvailable=11, catalogAvailabilityTotal=11, catalogCoverageTotal=11, projectionStockQuantity=11 | passed-runtime |
| Cleanup or archival evidence is recorded. | cleanupEvidence=deferred:stock-traceability-runbook-20260613 | passed-runtime |

## Smoke Output Summary

- product: c0de0000-0000-4000-8000-000000000001 / CODEX-STOCK-TRACE-001
- health: warehouse: healthy; catalog: healthy; suppliers: healthy
- warehouse topology: own=2, supplierManaged=1, totalAvailable=11
- warehouse origins: own:c0de0000-0000-4000-8000-000000000003:available=4:supplier=-; dropship:c0de0000-0000-4000-8000-000000000004:available=7:supplier=c0de0000-0000-4000-8000-000000000002
- routes: local_fulfillment,supplier_dropship
- coverage: covered / mixed_stock
- supplier job: status=completed, idempotencyKey=manual:traceability-20260613-003, authority=warehouse-microservice, attempted=yes, approved=yes, updatedProducts=1
- cleanup evidence: deferred:stock-traceability-runbook-20260613

## Completion Decision

Runtime complete

## Boundary Evidence

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval or remained deferred by recorded evidence.
