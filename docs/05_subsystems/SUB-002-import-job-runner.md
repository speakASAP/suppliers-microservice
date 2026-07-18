# SUB-002: Import Job Runner

```yaml
id: SUB-002
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../04_systems/SYS-001-supplier-import-service.md
downstream:
  - ../10_features/FEAT-001-supplier-api-integration.md
  - ../10_features/FEAT-003-import-job-tracking.md
related_adrs: []
```

## Purpose

Create, run, and track supplier import jobs.

## Parent system

`SYS-001: Supplier Import Service`.

## Responsibilities

- Create import job records.
- List recent import jobs globally or by supplier.
- Transition jobs through pending, running, completed, and failed states.
- Store product counters and structured errors.
- Coordinate supplier fetch, transformation, validation, catalog update, and warehouse update steps as integrations mature.

## Interfaces

- `GET /api/imports`
- `GET /api/imports?supplierId=:id`
- `POST /api/imports/run/:supplierId`
- `ImportsService.createJob`
- `ImportsService.runImport`

## Dependencies

- TypeORM repository for `ImportJob`.
- `HttpService` for downstream or supplier HTTP integration.
- Catalog service URL from `CATALOG_SERVICE_URL` or default `http://catalog-microservice:3200`.

## Data ownership

Owns import job status, counts, timestamps, and error summaries. It must not store supplier credential values in `errors`.

## Failure modes

- Supplier import fails after job creation.
- Job remains running if the process crashes mid-import.
- Downstream catalog or warehouse service is unavailable.
- Import is re-run without idempotency controls.
- Supplier API returns malformed or unmapped data.

## Validation criteria

- Jobs transition to `running` before import work begins.
- Jobs transition to `completed` or `failed` with completion timestamp.
- Failed jobs record actionable errors without secrets.
- Re-run behavior is validated before downstream writes are enabled.

## Change Note

- 2026-06-12: Initial subsystem document created.

## Inputs

Supplier UUIDs, supplier source responses, mapping state, and downstream service availability.

## Outputs

Import job records, status transitions, counters, timestamps, and safe error summaries.

## Validation

Build checks pass and outputs do not expose supplier credentials.
