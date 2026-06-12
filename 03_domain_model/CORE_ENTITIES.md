# Core Entities

```yaml
id: CORE-ENTITIES
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ./GLOSSARY.md
  - ../06_architecture/ARCHITECTURE_OVERVIEW.md
downstream:
  - ../05_subsystems/SUB-001-supplier-registry.md
  - ../05_subsystems/SUB-002-import-job-runner.md
  - ../05_subsystems/SUB-003-category-mapping.md
related_adrs: []
```

## Supplier

Source: `src/suppliers/supplier.entity.ts`.

Fields include `id`, `name`, `code`, `apiType`, `apiUrl`, `apiCredentials`, `syncSchedule`, `isActive`, `lastSyncAt`, `lastSyncStatus`, `createdAt`, and `updatedAt`.

Sensitive field: `apiCredentials` may contain API keys, usernames, passwords, or tokens. Documentation and test data must not include real values.

## ImportJob

Source: `src/imports/import-job.entity.ts`.

Fields include `id`, `supplierId`, `status`, product counters, `errors`, `startedAt`, `completedAt`, `createdAt`, and `updatedAt`.

Statuses documented in code are `pending`, `running`, `completed`, and `failed`.

## CategoryMapping

Source: `src/mappings/category-mapping.entity.ts`.

Fields include `id`, `supplierId`, `supplierCategoryId`, `supplierCategoryName`, `catalogCategoryId`, and `createdAt`.

The pair `supplierId` and `supplierCategoryId` is unique.

## Change Note

- 2026-06-12: Initial entity model documented from TypeORM entities.
