# SUB-003: Category Mapping

```yaml
id: SUB-003
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../04_systems/SYS-001-supplier-import-service.md
downstream:
  - ../10_features/FEAT-002-category-mapping.md
related_adrs: []
```

## Purpose

Maintain the mapping from supplier category identifiers to catalog category identifiers.

## Parent system

`SYS-001: Supplier Import Service`.

## Responsibilities

- Return mappings for a supplier.
- Create or update a mapping for a supplier category.
- Enforce uniqueness for `supplierId` and `supplierCategoryId`.
- Support mapping completeness review before import data is catalog-ready.

## Interfaces

- `GET /api/mappings/supplier/:supplierId`
- `POST /api/mappings`
- `MappingsService.findBySupplier`
- `MappingsService.setMapping`

## Dependencies

- TypeORM repository for `CategoryMapping`.
- Catalog category identifiers from `catalog-microservice`.

## Data ownership

Owns supplier-category to catalog-category relationships. It references catalog categories but does not own catalog taxonomy.

## Failure modes

- Missing mapping blocks safe catalog import.
- Mapping points to a deleted or invalid catalog category.
- Supplier category IDs change upstream.
- Duplicate mapping attempts conflict with unique constraints if not handled by service logic.

## Validation criteria

- Mapping upsert preserves the unique supplier/category relationship.
- Mapping list is filterable by supplier UUID.
- Completeness review identifies unmapped supplier categories before imports push data downstream.

## Change Note

- 2026-06-12: Initial subsystem document created.

## Inputs

Supplier UUIDs, supplier category identifiers, supplier category names, and catalog category identifiers.

## Outputs

Supplier mapping lists and upserted category mapping records.

## Validation

Build checks pass and outputs do not expose supplier credentials.
