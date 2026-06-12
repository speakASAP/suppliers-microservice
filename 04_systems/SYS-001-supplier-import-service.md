# SYS-001: Supplier Import Service

```yaml
id: SYS-001
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../01_vision/VISION.md
  - ../02_business_case/BUSINESS_CASE.md
downstream:
  - ../05_subsystems/SUB-001-supplier-registry.md
  - ../05_subsystems/SUB-002-import-job-runner.md
  - ../05_subsystems/SUB-003-category-mapping.md
related_adrs:
  - ADR-001
```

## Purpose

Provide the service boundary for configuring suppliers, executing supplier imports, mapping supplier categories to catalog categories, and tracking import jobs.

## Responsibilities

- Maintain active supplier configuration records.
- Store supplier API connection metadata.
- Run supplier imports manually and eventually on schedules.
- Track import job lifecycle and product counters.
- Maintain supplier-category to catalog-category mappings.
- Expose health and API endpoints under the `/api` prefix.

## Non-responsibilities

- Owning the catalog product data model.
- Owning warehouse stock persistence.
- Storing supplier credentials in documentation or committed fixtures.
- Accepting unvalidated supplier data as catalog-ready.

## Inputs

- Supplier configuration requests.
- Supplier import run requests.
- Supplier API responses or files.
- Category mapping updates.
- Environment variables for database, catalog URL, JWT, and secrets.

## Outputs

- Supplier records.
- Import job records and status responses.
- Category mapping records.
- Validated downstream product and stock updates when import implementation is completed.

## Dependencies

- PostgreSQL at `db-server-postgres:5432`.
- `catalog-microservice` at `catalog-microservice:3200`.
- `warehouse-microservice` at `warehouse-microservice:3201` per README.
- `logging-microservice` at `logging-microservice:3367` per `SYSTEM.md`.
- JWT role guard in `src/auth`.

## Upstream traceability

- Vision goal: automated supplier product and stock import.
- Business constraint: no catalog pushes without validation.
- Business constraint: supplier credentials managed in environment configuration only.
- Business constraint: import jobs are idempotent.

## Downstream artifacts

- `10_features/FEAT-001-supplier-api-integration.md`
- `10_features/FEAT-002-category-mapping.md`
- `10_features/FEAT-003-import-job-tracking.md`
- `12_validation/VALIDATION_PYRAMID.md`

## Validation criteria

- Service builds successfully with `npm run build`.
- Health endpoint is available after deployment.
- API endpoints preserve documented response envelopes.
- Import writes to downstream services only after validation evidence exists.
- Logs and errors do not expose supplier credentials.

## Open questions

- [UNKNOWN: exact supplier-specific validation rules must be defined per supplier integration before implementation]
- [UNKNOWN: complete production auth and role matrix must be confirmed by the service owner]

## Change Note

- 2026-06-12: Initial system document created from root docs and source code.

## Validation

- `npm run build` compiles the service.
- IPS gates pass before coding.
- Imports validate supplier data before catalog writes.
