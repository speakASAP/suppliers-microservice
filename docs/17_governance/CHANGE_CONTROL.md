# Change Control

```yaml
id: CHANGE-CONTROL
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ./PROJECT_INVARIANTS.md
downstream: []
related_adrs: []
```

## Rules

- Changes under `docs/00_constitution/` and `docs/01_vision/` require owner review.
- Runtime changes require an upstream task, goal impact record, execution plan, and validation report.
- Supplier integrations require sensitive-data, contract, and replay/idempotency review.
- Deployment-affecting changes require deployment-readiness evidence.
- ADRs are required for architecture, contract, persistence, or operational boundary changes.

## Change Note

- 2026-06-12: Initial change-control document created.
