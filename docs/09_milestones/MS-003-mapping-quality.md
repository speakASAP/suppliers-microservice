# MS-003: Mapping Quality

```yaml
id: MS-003
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../08_roadmap/ROADMAP.md
downstream:
  - ../11_tasks/TASK-003-review-category-mapping-completeness.md
related_adrs: []
```

## Goal

Ensure supplier category mappings are complete enough to support safe catalog import decisions.

## Completion Criteria

- Active suppliers can be reviewed for mapping coverage.
- Missing mappings are reported without exposing credentials or production-sensitive data.
- Import plans define how unmapped categories block or quarantine downstream writes.

## Change Note

- 2026-06-12: Initial milestone created from backlog.
