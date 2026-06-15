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
| Warehouse | 51fbd450a450cd69b129949e573fa07ec5784671 | ./scripts/deploy.sh | Warehouse /api/health returned HTTP 200 healthy after deployment at 51fbd45 | Anonymous Warehouse /api/warehouses/topology returned HTTP 401 after deployment |
| Catalog | b0675aa51ef640a7e17eb7cb1465e59ca22b93ea | ./scripts/deploy.sh | Catalog /health returned HTTP 200 healthy after deployment at b0675aa | Anonymous Catalog POST /api/products/availability/coverage returned HTTP 401 after deployment |
| Suppliers | 8a8072c6ec1e8d826f9ad640a4079aa26d427e73 | ./scripts/deploy.sh | Suppliers /api/health returned HTTP 200 healthy after deployment at 8a8072c after explicit rollout restart | Anonymous Suppliers /api/imports returned HTTP 401 after deployment |

## Fixture Check Command Evidence

```bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=c0de0000-0000-4000-8000-000000000011 TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000013 TRACE_SUPPLIER_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000014 TRACE_DROPSHIP_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000015 node reports/validation/runtime-stock-traceability-smoke.js --fixture-check
```

## Smoke Command Evidence

```bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=c0de0000-0000-4000-8000-000000000011 TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000013 TRACE_SUPPLIER_ID=c0de0000-0000-4000-8000-000000000012 TRACE_SUPPLIER_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000014 TRACE_DROPSHIP_WAREHOUSE_ID=c0de0000-0000-4000-8000-000000000015 TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-20260615-001 TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:stock-traceability-runbook-20260615 RUNTIME_APPROVAL_ARTIFACT_FILE=/tmp/stock-traceability-runtime-approval.json TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js
```

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Read-only live fixture check passed before mutation. | status=fixture-ready, fixtureCheck=yes, mutationEnabled=no, importTriggered=no, own=c0de0000-0000-4000-8000-000000000013, supplier=c0de0000-0000-4000-8000-000000000014, dropship=c0de0000-0000-4000-8000-000000000015, routes=local_fulfillment,supplier_replenishment,supplier_dropship | passed-runtime |
| Warehouse, Catalog, and Suppliers health endpoints passed. | warehouse: healthy; catalog: healthy; suppliers: healthy | passed-runtime |
| Catalog product identity exists. | productId=c0de0000-0000-4000-8000-000000000011, sku=CODEX-STOCK-TRACE-011, expectedSkuPrefix=CODEX-STOCK-TRACE- | passed-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | own=2, supplierManaged=2, totalAvailable=18 | passed-runtime |
| Warehouse availability returns own plus supplier and dropship stock. | own:c0de0000-0000-4000-8000-000000000013:available=4:supplier=-; supplier:c0de0000-0000-4000-8000-000000000014:available=7:supplier=c0de0000-0000-4000-8000-000000000012; dropship:c0de0000-0000-4000-8000-000000000015:available=7:supplier=c0de0000-0000-4000-8000-000000000012 | passed-runtime |
| Warehouse logistics returns local, supplier replenishment, and dropship route options. | routes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[available=4;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000013;supplier=-;1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000014;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000015;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-DROP-011>customer:supplier] | passed-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | source=warehouse, warehouseCount=3, logisticsOptionCount=3, preferredRoute=local_fulfillment, routeTypes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[available=4;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000013;supplier=-;1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000014;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000015;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-DROP-011>customer:supplier] | passed-runtime |
| Catalog coverage and audit classify covered mixed stock. | coverage=covered, origin=mixed_stock, audit=covered/mixed_stock | passed-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | productId=c0de0000-0000-4000-8000-000000000011, source=warehouse, stockQuantity=18, routeCount=3, routeTypes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[available=4;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000013;supplier=-;1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000014;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000015;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-DROP-011>customer:supplier] | passed-runtime |
| Suppliers import preserves Catalog identity and Warehouse authority. | status=completed, idempotencyKey=manual:traceability-20260615-001, sourceFingerprint=trace:c0de0000-0000-4000-8000-000000000011:c0de0000-0000-4000-8000-000000000014:c0de0000-0000-4000-8000-000000000015:7:SUP-SKU-TRACE, catalogProductValidation=passed, checkedProducts=c0de0000-0000-4000-8000-000000000011, authority=warehouse-microservice, attempted=yes, approved=yes, updatedProducts=2 | passed-runtime |
| Warehouse remains stock authority across totals. | source=warehouse, warehouseTotalAvailable=18, warehouseOriginAvailable=18, catalogAvailabilityTotal=18, catalogCoverageTotal=18, projectionStockQuantity=18, projectionSellableRouteAvailable=18 | passed-runtime |
| Cleanup or archival evidence is recorded. | cleanupEvidence=deferred:stock-traceability-runbook-20260615 | passed-runtime |

## Smoke Output Summary

- product: c0de0000-0000-4000-8000-000000000011 / CODEX-STOCK-TRACE-011
- fixture check: status=fixture-ready, fixtureCheck=yes, mutationEnabled=no, importTriggered=no, own=c0de0000-0000-4000-8000-000000000013, supplier=c0de0000-0000-4000-8000-000000000014, dropship=c0de0000-0000-4000-8000-000000000015, routes=local_fulfillment,supplier_replenishment,supplier_dropship
- health: warehouse: healthy; catalog: healthy; suppliers: healthy
- warehouse topology: own=2, supplierManaged=2, totalAvailable=18
- warehouse origins: own:c0de0000-0000-4000-8000-000000000013:available=4:supplier=-; supplier:c0de0000-0000-4000-8000-000000000014:available=7:supplier=c0de0000-0000-4000-8000-000000000012; dropship:c0de0000-0000-4000-8000-000000000015:available=7:supplier=c0de0000-0000-4000-8000-000000000012
- routes: local_fulfillment,supplier_replenishment,supplier_dropship
- route legs: local_fulfillment[available=4;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000013;supplier=-;1:CODEX-OWN-011>customer:warehouse],supplier_replenishment[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000014;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-SUP-011>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=c0de0000-0000-4000-8000-000000000015;supplier=c0de0000-0000-4000-8000-000000000012;1:CODEX-DROP-011>customer:supplier]
- coverage: covered / mixed_stock
- supplier job: status=completed, idempotencyKey=manual:traceability-20260615-001, sourceFingerprint=trace:c0de0000-0000-4000-8000-000000000011:c0de0000-0000-4000-8000-000000000014:c0de0000-0000-4000-8000-000000000015:7:SUP-SKU-TRACE, catalogProductValidation=passed, checkedProducts=c0de0000-0000-4000-8000-000000000011, authority=warehouse-microservice, attempted=yes, approved=yes, updatedProducts=2
- cleanup evidence: deferred:stock-traceability-runbook-20260615

## Completion Decision

Runtime complete

## Boundary Evidence

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval or remained deferred by recorded evidence.
