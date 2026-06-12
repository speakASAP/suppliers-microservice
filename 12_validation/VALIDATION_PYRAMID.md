# Validation Pyramid

```yaml
id: VALIDATION-PYRAMID
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../01_vision/VISION.md
  - ../17_governance/PROJECT_INVARIANTS.md
downstream:
  - ./VAL-TASK-001-ips-documentation-bootstrap.md
related_adrs: []
```

## Levels

1. Documentation traceability: IPS audit, required sections, upstream and downstream links.
2. Build validation: `npm run build`.
3. Unit or service validation: targeted tests for services, controllers, and transformations when added.
4. Contract validation: supplier source contracts and downstream catalog or warehouse payloads.
5. Sensitive-data validation: no credentials in docs, prompts, logs, fixtures, or reports.
6. Replay and idempotency validation: import re-runs are safe before downstream writes are enabled.
7. Deployment readiness: gate scripts plus production health checks.

## Required Evidence

Every implementation task must produce a validation report that records command output summaries, contract evidence when applicable, sensitive-data handling, and replay/idempotency evidence when imports are affected.

## Change Note

- 2026-06-12: Initial validation pyramid created.
