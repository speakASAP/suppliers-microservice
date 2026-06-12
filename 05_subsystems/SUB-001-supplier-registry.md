# SUB-001: Supplier Registry

```yaml
id: SUB-001
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../04_systems/SYS-001-supplier-import-service.md
downstream:
  - ../10_features/FEAT-001-supplier-api-integration.md
related_adrs: []
```

## Purpose

Manage supplier configuration records used by import workflows.

## Parent system

`SYS-001: Supplier Import Service`.

## Responsibilities

- Create supplier records.
- Read active supplier records.
- Update supplier records.
- Track last synchronization time and status.
- Keep API type and source URL metadata available to import workflows.

## Interfaces

- `GET /api/suppliers`
- `GET /api/suppliers/:id`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `SuppliersService.updateSyncStatus`

## Dependencies

- TypeORM repository for `Supplier`.
- PostgreSQL `suppliers` table.
- JWT role guard applied globally.

## Data ownership

Owns supplier configuration metadata. Supplier credential values are sensitive and must be handled according to `23_documentation_contracts/SENSITIVE_DATA_POLICY.md` and `17_governance/PROJECT_INVARIANTS.md`.

## Failure modes

- Supplier UUID does not exist.
- Duplicate supplier code conflicts with unique constraint.
- Invalid or missing credentials cause supplier import failure.
- Real credentials accidentally appear in docs, logs, prompts, or fixtures.

## Validation criteria

- Supplier CRUD endpoints preserve response shape `{ success: true, data }`.
- Active supplier listing excludes inactive suppliers.
- Supplier credential handling is covered by sensitive-data review before any integration work.

## Change Note

- 2026-06-12: Initial subsystem document created.

## Inputs

Supplier create/update requests, supplier UUID lookups, and environment-backed credential references.

## Outputs

Supplier records, active supplier lists, and last sync status updates.

## Validation

Build checks pass and outputs do not expose supplier credentials.
