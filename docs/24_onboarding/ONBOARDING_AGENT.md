# Onboarding Agent Brief

```yaml
id: ONBOARDING-AGENT
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../01_vision/VISION.md
  - ../17_governance/AI_AGENT_RULES.md
downstream: []
related_adrs: []
```

## Start Here

Read `AGENTS.md`, `docs/00_constitution/CONSTITUTION.md`, `docs/01_vision/VISION.md`, `docs/17_governance/PROJECT_INVARIANTS.md`, and the task-specific execution plan before making changes.

## Service Summary

`suppliers-microservice` is a NestJS/PostgreSQL service for supplier configuration, category mapping, and supplier product/stock import jobs.

## Non-Negotiables

- Do not expose supplier credentials.
- Do not push unvalidated supplier data to catalog.
- Preserve idempotent import behavior.
- Do not invent approvals.
- Do not code from unapproved vague tasks.

## Current Backlog

- `TASK-002`: add new supplier API integration.
- `TASK-003`: review category mapping completeness.

## Change Note

- 2026-06-12: Initial onboarding brief created.
