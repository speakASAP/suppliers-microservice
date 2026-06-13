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
| Warehouse | 6992122d86f7cf0926b7702185f000982395aa0b | ./scripts/deploy.sh | https://warehouse.alfares.cz/api/health returned healthy warehouse-microservice after deployment | anonymous GET https://warehouse.alfares.cz/api/warehouses/topology returned 401 |
| Catalog | 890f55a35b107e2e4038281fa5c4de99232d7343 | ./scripts/deploy.sh; rollout completed; manual health check used because script selected a completed cronjob pod during health phase | https://catalog.alfares.cz/health returned healthy catalog-microservice after deployment | anonymous POST https://catalog.alfares.cz/api/products/availability/coverage returned 401 |
| Suppliers | a6fc69d220e04aa055345c2ee1606bad21cc5a06 | ./scripts/deploy.sh plus kubectl rollout restart deployment/suppliers-microservice -n statex-apps because deployment uses mutable latest tag | https://suppliers.alfares.cz/api/health returned healthy suppliers-microservice after deployment | anonymous GET https://suppliers.alfares.cz/api/imports returned 401 |

## Fixture Check Command Evidence

```bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=c0de0000-0000-4000-8000-000000000011 TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000013 TRACE_SUPPLIER_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000014 TRACE_DROPSHIP_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000015 node reports/validation/runtime-stock-traceability-smoke.js --fixture-check
```

## Smoke Command Evidence

```bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=c0de0000-0000-4000-8000-000000000011 TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=c0de0000-0000-4000-8000-000000000012 TRACE_SUPPLIER_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000014 TRACE_DROPSHIP_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000015 TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-20260613-012 TRACE_CLEANUP_EVIDENCE=deferred:owner-approved-synthetic-traceability-fixture-20260613 TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js
```

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Read-only live fixture check passed before mutation. | status=fixture-ready, fixtureCheck=yes, mutationEnabled=no, importTriggered=no, own=c0de0000-0000-4000-8000-000000000013, supplier=c0de0000-0000-4000-8000-000000000014, dropship=c0de0000-0000-4000-8000-000000000015, routes=local_fulfillment,supplier_replenishment,supplier_dropship | passed-runtime |
| Warehouse, Catalog, and Suppliers health endpoints passed. | warehouse: healthy; catalog: healthy; suppliers: healthy | passed-runtime |
| Catalog product identity exists. | productId=c0de0000-0000-4000-8000-000000000011, sku=CODEX-STOCK-TRACE-011, expectedSkuPrefix=CODEX-STOCK-TRACE- | passed-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | own=2, supplierManaged=2, totalAvailable=18 | passed-runtime |
| Warehouse availability returns own plus supplier and dropship stock. | own:c0de0000-0000-4000-8000-000000000013:available=4:supplier=-; supplier:c0de0000-0000-4000-8000-000000000014:available=7:supplier=c0de0000-0000-4000-8000-000000000012; dropship:c0de0000-0000-4000-8000-000000000015:available=7:supplier=c0de0000-0000-4000-8000-000000000012 | passed-runtime |
| Warehouse logistics returns local, supplier replenishment, and dropship route options. | routes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[1:CODEX-DROP-011>customer:supplier] | passed-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | source=warehouse, warehouseCount=3, logisticsOptionCount=3, preferredRoute=local_fulfillment, routeTypes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[1:CODEX-DROP-011>customer:supplier] | passed-runtime |
| Catalog coverage and audit classify covered mixed stock. | coverage=covered, origin=mixed_stock, audit=covered/mixed_stock | passed-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | productId=c0de0000-0000-4000-8000-000000000011, source=warehouse, stockQuantity=18, routeCount=3, routeTypes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[1:CODEX-DROP-011>customer:supplier] | passed-runtime |
| Suppliers import preserves Warehouse authority. | status=completed, idempotencyKey=manual:traceability-20260613-012, authority=warehouse-microservice, attempted=yes, approved=yes, updatedProducts=2 | passed-runtime |
| Warehouse remains stock authority across totals. | source=warehouse, warehouseTotalAvailable=18, warehouseOriginAvailable=18, catalogAvailabilityTotal=18, catalogCoverageTotal=18, projectionStockQuantity=18 | passed-runtime |
| Cleanup or archival evidence is recorded. | cleanupEvidence=deferred:owner-approved-synthetic-traceability-fixture-20260613 | passed-runtime |

## Smoke Output Summary

- product: c0de0000-0000-4000-8000-000000000011 / CODEX-STOCK-TRACE-011
- fixture check: status=fixture-ready, fixtureCheck=yes, mutationEnabled=no, importTriggered=no, own=c0de0000-0000-4000-8000-000000000013, supplier=c0de0000-0000-4000-8000-000000000014, dropship=c0de0000-0000-4000-8000-000000000015, routes=local_fulfillment,supplier_replenishment,supplier_dropship
- health: warehouse: healthy; catalog: healthy; suppliers: healthy
- warehouse topology: own=2, supplierManaged=2, totalAvailable=18
- warehouse origins: own:c0de0000-0000-4000-8000-000000000013:available=4:supplier=-; supplier:c0de0000-0000-4000-8000-000000000014:available=7:supplier=c0de0000-0000-4000-8000-000000000012; dropship:c0de0000-0000-4000-8000-000000000015:available=7:supplier=c0de0000-0000-4000-8000-000000000012
- routes: local_fulfillment,supplier_replenishment,supplier_dropship
- route legs: local_fulfillment[1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[1:CODEX-DROP-011>customer:supplier]
- coverage: covered / mixed_stock
- supplier job: status=completed, idempotencyKey=manual:traceability-20260613-012, authority=warehouse-microservice, attempted=yes, approved=yes, updatedProducts=2
- cleanup evidence: deferred:owner-approved-synthetic-traceability-fixture-20260613

## Completion Decision

Runtime complete

## Boundary Evidence

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval or remained deferred by recorded evidence.
