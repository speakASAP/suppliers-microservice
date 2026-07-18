# Business Case: Supplier Import Automation

```yaml
id: BUSINESS-CASE
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../BUSINESS.md
  - ../01_vision/VISION.md
downstream:
  - ../04_systems/SYS-001-supplier-import-service.md
  - ../10_features/FEAT-001-supplier-api-integration.md
  - ../10_features/FEAT-002-category-mapping.md
  - ../10_features/FEAT-003-import-job-tracking.md
related_adrs: []
```

## Problem

Supplier product and stock data arrive through different supplier-specific APIs and file formats. Without a dedicated ingestion service, catalog and stock updates risk becoming manual, inconsistent, unsafe to retry, or insufficiently validated.

## Business Goal

Automate product imports from supplier REST, XML, CSV, and compatible APIs with category mapping, scheduled synchronization, and trackable job execution.

## Users and Consumers

- Internal Alfares services that need supplier product and stock data.
- `flipflop-service` and `allegro-service` as documented consumers.
- Operations staff monitoring import status and failures.
- Catalog and warehouse services receiving validated output.

## Value

- Reduces manual supplier data handling.
- Creates a consistent boundary for supplier credentials and external API behavior.
- Preserves traceability for every import run.
- Supports safe retries through idempotent job behavior.
- Protects catalog quality by requiring validation before downstream writes.

## Success Metrics

- Import jobs are trackable as pending, running, completed, or failed.
- Failed records include actionable error evidence without leaking credentials.
- Supplier category mappings are reviewable per supplier.
- Re-running an import does not create unsafe duplicate catalog or stock effects.
- Production health remains available at `/health`.

## Constraints

- Supplier credentials must stay in environment-managed configuration.
- No unvalidated supplier data may be pushed to catalog.
- Import jobs must be idempotent.
- Production service port is `3202`.

## Change Note

- 2026-06-12: Initial business case created from `BUSINESS.md`, `README.md`, and `SYSTEM.md`.
