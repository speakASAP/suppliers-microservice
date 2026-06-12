# Project Invariants

```yaml
id: PROJECT-INVARIANTS
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../00_constitution/CONSTITUTION.md
  - ../01_vision/VISION.md
downstream:
  - ../11_tasks/TASK-002-add-new-supplier-api-integration.md
  - ../11_tasks/TASK-003-review-category-mapping-completeness.md
related_adrs: []
```

## Invariants

1. Supplier credentials must not be committed or exposed in docs, prompts, logs, fixtures, reports, or examples.
2. Supplier data must be validated before any catalog write.
3. Import jobs must remain idempotent and safe to re-run.
4. Category mapping completeness must be considered before supplier category data is treated as catalog-ready.
5. API response envelopes must preserve the documented `{ success: true, data }` shape unless an ADR approves a contract change.
6. Production service identity must remain port `3202` and `https://supplier.alfares.cz` unless operational docs and deployment configuration are updated together.
7. AI-created docs must not be marked approved or validated without human review evidence.

## Change Note

- 2026-06-12: Initial project invariants created from `BUSINESS.md` and source docs.
