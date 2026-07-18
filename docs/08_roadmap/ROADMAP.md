# Roadmap

```yaml
id: ROADMAP
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../01_vision/VISION.md
  - ../02_business_case/BUSINESS_CASE.md
downstream:
  - ../09_milestones/MS-001-ips-foundation.md
  - ../09_milestones/MS-002-supplier-integration-readiness.md
  - ../09_milestones/MS-003-mapping-quality.md
related_adrs:
  - ADR-001
```

## Sequence

1. Establish IPS documentation foundation and compliance gates.
2. Review category mapping completeness for active suppliers.
3. Add supplier-specific API integrations through approved execution plans.
4. Strengthen idempotency and validation evidence before downstream catalog or stock writes.
5. Add operational reporting around job failures and retry safety.

## Current Focus

`STATE.json` lists the next focus as owner review and update. The open backlog from `TASKS.md` is supplier API integration and category mapping completeness review.

## Change Note

- 2026-06-12: Initial roadmap created from root task and state docs.
