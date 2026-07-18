# PROMPT-TASK-003: Review Category Mapping Completeness

```yaml
id: PROMPT-TASK-003
status: implemented
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../21_execution_plans/EP-TASK-003-review-category-mapping-completeness.md
downstream:
  - ../13_context_packages/CP-TASK-003-review-category-mapping-completeness.md
related_adrs:
  - ../07_decisions/ADR-001-adopt-intent-preservation-system.md
```

## Role

Implementation agent preserving Suppliers category-mapping and Catalog ownership boundaries.

## Task

Prepare the Goal 3 import-job migration artifact before deployment, then implement the service-local Goal 4 slice for category mapping completeness and Catalog boundary enforcement.

## Context

Use `BUSINESS.md`, `SYSTEM.md`, `README.md`, `docs/orchestrator/*`, `docs/10_features/FEAT-002-category-mapping.md`, `docs/11_tasks/TASK-003-review-category-mapping-completeness.md`, and `docs/21_execution_plans/EP-TASK-003-review-category-mapping-completeness.md`.

## Constraints

Do not apply production migrations, deploy, query production supplier payloads, expose supplier credentials, mutate Catalog taxonomy, approve mappings automatically, write Catalog products, or mutate Warehouse stock.

## Acceptance Criteria

- Import-job migration exists as a source artifact and is clearly owner-approval gated.
- Mapping create/update identifiers are DTO-validated.
- Duplicate mapping updates remain deterministic upserts for `supplierId` and `supplierCategoryId`.
- Mapping completeness can be checked for caller-supplied supplier category IDs.
- Missing mapping behavior and Catalog ownership boundary are documented.

## Validation

Run `python3 scripts/pre_coding_gate.py --root .`, `npm run build`, a synthetic compiled-service mapping completeness check, and `python3 scripts/deployment_readiness_gate.py --root .`.

## Change Note

- 2026-06-13: Added for Goal 4 graph compliance and implementation traceability.
