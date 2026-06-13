# Cross-Service Stock Traceability Flow

Metadata:
- id: CROSS-STOCK-TRACEABILITY
- status: source-validated
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: complete
- upstream: implementation-goals/GOAL-07-warehouse-reconciliation-client.md, warehouse-microservice implementation-goals/GOAL-15-batch-logistics-contract.md, catalog-microservice implementation-goals/GOAL-11-logistics-route-projection.md, catalog-microservice implementation-goals/GOAL-12-warehouse-stock-coverage-read-model.md

## Purpose

This document defines how one sellable good can be traced across Suppliers, Warehouse, and Catalog without moving ownership between services.

## Ownership Model

| Domain fact | Owning service | Notes |
| --- | --- | --- |
| Product identity, SKU, title, categories, media, pricing, readiness | Catalog | Catalog product ID is the product key used by Warehouse stock rows. |
| Physical warehouse, supplier replenishment and dropship warehouse, quantity, reserved, available, movements, reservations, origin metadata, logistics route plans | Warehouse | Warehouse is the only stock authority. |
| Supplier connection metadata, credential references, import job idempotency, supplier payload validation, category mapping, supplier stock candidates | Suppliers | Suppliers validates and orchestrates; it does not become stock authority. |

## Trace Path

1. Catalog owns the product record and exposes the Catalog product ID.
2. A supplier adapter, after future owner-supplied supplier contract approval, normalizes supplier stock into a Suppliers stock candidate with supplierSku, productId, warehouseId, stockQuantity, and observedAt.
3. Suppliers validates the candidate and blocks malformed, duplicate, or unapproved mutation attempts. One import may contain only one Warehouse stock candidate for a given `productId` and `warehouseId`; duplicates are rejected before approved mutation so a supplier feed cannot send competing quantities for the same product-origin pair.
4. If a run is explicitly approved for mutation, Suppliers calls Warehouse `POST /api/supplier-reconciliations` with supplierId, warehouseId, productId, quantity, externalReference, actor, and observedAt.
5. Warehouse applies the reconciliation only to supplier replenishment and dropship warehouses, preserves movement/reconciliation evidence, and remains stock authority.
6. Warehouse batch availability returns total quantities plus per-warehouse rows with warehouseCode, warehouseName, warehouseType, and supplierId.
7. Warehouse product logistics returns local fulfillment, supplier replenishment, and supplier dropship route options plus ordered route legs from the same stock-origin data.
8. Catalog availability/projection reads Warehouse availability and batch logistics, then forwards stock-origin rows and `availability.logistics` route options and legs with source `warehouse`.
9. Catalog coverage reads the same Warehouse availability/logistics data and classifies products as local, supplier, dropship, mixed, or missing Warehouse-backed stock coverage.
10. Storefront/channel/order consumers can distinguish own physical stock from supplier replenishment and dropship virtual stock and see the Warehouse-owned logistics route while still reserving/fulfilling stock through Warehouse.

## Logistics Interpretation

| Origin | Meaning | Customer/order implication |
| --- | --- | --- |
| own | Stock is physically held by Alfares in a local warehouse. | Warehouse reservation and fulfillment happen from local stock. |
| supplier | Stock is held by a supplier warehouse and represented in Warehouse as supplier-origin availability. | Order flow must account for supplier lead time before customer fulfillment. |
| dropship | Supplier ships directly or via a virtual dropship location. | Order flow must route fulfillment through supplier replenishment and dropship process while Warehouse remains availability authority. |
| mixed | A product has both own and supplier replenishment and dropship rows. | Allocation can prefer own stock first, then supplier stock according to Warehouse priority and order rules. |

## Synthetic Evidence Chain

The validation script `reports/validation/synthetic-stock-traceability-check.js` proves this source-level contract with synthetic data only:

- Suppliers validation accepts a complete approved candidate and blocks malformed or unapproved candidates.
- The expected Warehouse reconciliation request contains the required Warehouse contract fields and an idempotency-derived external reference.
- The expected Warehouse availability response carries local and supplier replenishment and dropship rows with origin metadata.
- The expected Catalog projection preserves Warehouse-origin rows under `availability.warehouses[]`, preserves Warehouse-owned route options and route legs under `availability.logistics`, and keeps `stockQuantity` equal to Warehouse `totalAvailable`.
- The expected Catalog coverage read model marks the mixed local plus dropship product as `covered`, `mixed_stock`, and sellable only because Warehouse reports positive available stock and a reservable route.

## Runtime Evidence Needed Later

Completion criteria are audited requirement-by-requirement in `docs/cross-service/stock-traceability-completion-audit.md`.


Full completion still needs owner-approved runtime evidence after deployment:

- Deploy Warehouse WH-G11, Catalog CAT-G10, and Suppliers SUP-G7 source changes.
- Create or use an approved synthetic Catalog product.
- Create or use approved own and supplier replenishment and dropship Warehouse locations.
- Run an approved Suppliers reconciliation for supplier stock.
- Verify Catalog availability/projection returns both local and supplier-origin rows plus `availability.logistics` route options and legs.
- Verify Catalog coverage returns `covered`/`mixed_stock` for the synthetic mixed source product and blocking diagnostics for any product missing Warehouse stock or routes.
- Verify order/reservation logistics consume Warehouse availability/logistics rather than creating stock truth elsewhere.

The executable rollout checklist and smoke command are defined in `docs/cross-service/stock-traceability-runtime-rollout.md` and `reports/validation/runtime-stock-traceability-smoke.js`.

## Non-Goals

- No real supplier payloads or credentials are documented here.
- No production stock mutation is performed by this document or synthetic check.
- No Catalog stock persistence is introduced.
- No Warehouse ownership of product truth is introduced.
