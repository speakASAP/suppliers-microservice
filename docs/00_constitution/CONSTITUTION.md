# Constitution: suppliers-microservice

```yaml
id: CONSTITUTION
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../BUSINESS.md
downstream:
  - ../01_vision/VISION.md
  - ../17_governance/PROJECT_INVARIANTS.md
related_adrs: []
```

## Purpose

This constitution preserves the non-negotiable delivery rules for the suppliers microservice. It is derived from `BUSINESS.md`, which is marked immutable by AI.

## Immutable Rules

1. Supplier credentials must be managed through environment configuration and must not be committed to repository documentation, fixtures, prompts, logs, or examples.
2. Supplier imports must not push supplier data to the catalog without validation.
3. Import jobs must remain idempotent and safe to re-run.
4. Category mappings must preserve an explicit supplier-category to catalog-category relationship before supplier category data is treated as catalog-ready.
5. Production service identity is `suppliers-microservice` on port `3202`, exposed at `https://supplier.alfares.cz`.

## Authority

The upstream authority for these rules is `BUSINESS.md`. AI agents may draft downstream documentation and implementation plans, but must not claim human approval or weaken these rules.

## Amendment Process

Changes to this document require human review by the service owner and must be recorded in `docs/01_vision/VISION_EVOLUTION.md` and an ADR when the change affects architecture, contracts, data handling, or operational gates.

## Change Note

- 2026-06-12: Initial IPS constitution drafted from `BUSINESS.md`.
