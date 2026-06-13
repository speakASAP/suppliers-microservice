# Integrations

```yaml
id: INTEGRATIONS
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../06_architecture/ARCHITECTURE_OVERVIEW.md
downstream:
  - ../21_execution_plans/EP-TASK-002-add-new-supplier-api-integration.md
related_adrs: []
```

## Runtime Dependencies

| Dependency | Purpose | Source |
| --- | --- | --- |
| PostgreSQL `db-server-postgres:5432` | Supplier, import job, and mapping persistence | `SYSTEM.md`, `src/app.module.ts` |
| `catalog-microservice:3200` | Target for validated imported products | `README.md`, `SYSTEM.md` |
| `warehouse-microservice:3201` | Target for validated imported stock | `README.md` |
| `logging-microservice:3367` | Logging integration | `SYSTEM.md` |
| Supplier APIs | External product and stock data sources | `BUSINESS.md`, `README.md` |

## Integration Rules

- Supplier credentials must be environment-managed.
- Supplier data must be validated before catalog or warehouse writes.
- Category mapping gaps must be handled explicitly.
- Missing supplier-category mappings block safe Catalog import for affected supplier category IDs.
- Suppliers may reference Catalog category IDs but must not create, rename, or redefine Catalog taxonomy.
- Import retries must preserve idempotency.
- Warehouse stock candidates must carry actor, reason, idempotency key, validation status, and sanitized failure evidence before any future Warehouse handoff.
- Production Warehouse stock mutation and stock verification require owner-approved chunks.

## Change Note

- 2026-06-12: Initial integrations document created.
- 2026-06-13: Added Goal 4 Catalog category ownership boundary and missing-mapping rule.
- 2026-06-13: Added Goal 5 Warehouse stock-boundary validation and owner-approval rules.
