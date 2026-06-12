# FEAT-003: Import Job Tracking

```yaml
id: FEAT-003
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../05_subsystems/SUB-002-import-job-runner.md
downstream:
  - ../11_tasks/TASK-002-add-new-supplier-api-integration.md
related_adrs: []
```

## User or system need

Operators and dependent services need import status, counts, timestamps, and errors to understand supplier import outcomes.

## Goal impact

Makes automated imports observable and supports safe retry and incident handling.

## Scope

- Create job records.
- List recent jobs.
- Track status transitions and timestamps.
- Track product counters and failure details.

## Non-goals

- Long-term analytics warehouse.
- Exposing secrets in error records.
- Replacing logging service responsibilities.

## Acceptance criteria

- Jobs are created before import work starts.
- Status transitions are visible through API.
- Failures include evidence sufficient for debugging without secrets.
- Re-run behavior is documented for supplier-specific integrations.

## Dependencies

- Import job entity and repository.
- Supplier integration implementation.
- Logging service.

## Validation strategy

Run build checks, targeted service tests when added, and inspect failure paths for secret leakage.

## Change Note

- 2026-06-12: Initial feature created from current implementation.

## Traceability

`../01_vision/VISION.md`, `../05_subsystems/SUB-002-import-job-runner.md`, `../11_tasks/TASK-002-add-new-supplier-api-integration.md`.

## Goal

Observable supplier imports with safe retry evidence.

## Validation

`npm run build` and the task-specific IPS gates pass before implementation is accepted.
