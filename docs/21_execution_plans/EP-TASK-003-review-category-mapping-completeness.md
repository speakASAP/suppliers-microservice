# EP-TASK-003: Review Category Mapping Completeness

```yaml
id: EP-TASK-003
status: implemented
source_task: ../11_tasks/TASK-003-review-category-mapping-completeness.md
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-002-category-mapping.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-003.md
```

## Metadata

Task: `TASK-003`. Lifecycle state: implemented for service-local validation. Production data queries remain owner-approval gated.

## Upstream Traceability

- `../10_features/FEAT-002-category-mapping.md`
- `../05_subsystems/SUB-003-category-mapping.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-003.md`

## Goal Impact

Improves catalog import safety by making mapping gaps visible before supplier data is imported downstream.

## Project Invariants

Preserves explicit mapping and validation-before-catalog-write invariants.

## Sensitive-Data Handling

Mapping review may include supplier IDs and category names. Reports must avoid credentials and unnecessary raw production payloads.

## Contract Validation Plan

The mapping API keeps the existing `POST /api/mappings` response envelope and adds `POST /api/mappings/supplier/:supplierId/validate` for caller-supplied category completeness checks.

## Replay/Determinism Plan

Mapping completeness checks should be deterministic for a given supplier/category dataset and timestamped in validation evidence.

## Scope

Define review method, identify missing mappings from supplied category IDs, and define import behavior for unmapped categories.

## Non-Goals

Automatic approval of mappings, production data queries, catalog taxonomy changes, or supplier integration implementation.

## Files to Inspect

- `src/mappings/category-mapping.entity.ts`
- `src/mappings/mappings.service.ts`
- `src/mappings/mappings.controller.ts`
- `src/suppliers/suppliers.service.ts`

## Files to Create

Validation report, DTOs, and migration artifact.

## Files to Modify

- `src/mappings/category-mapping.entity.ts`
- `src/mappings/mappings.service.ts`
- `src/mappings/mappings.controller.ts`
- `README.md`
- `docs/10_features/FEAT-002-category-mapping.md`
- `docs/12_validation/VAL-TASK-003-review-category-mapping-completeness.md`
- `docs/16_operations/INTEGRATIONS.md`

## Files That Must Not Be Modified

- `.env`
- `.env.backup*`
- `docs/00_constitution/`
- `docs/01_vision/`

## Implementation Steps

1. Confirm allowed data source for mapping review.
2. Prepare the Goal 3 import-job migration as a source artifact before deployment.
3. Define a supplied-category completeness check using masked or synthetic output.
4. Identify missing mappings from caller-supplied category IDs.
5. Define import behavior for unmapped categories.
6. Record validation evidence.

## Test Plan

Run `npm run build` because code changes occur. Validate completeness behavior against synthetic examples.

## Validation Plan

Create `../12_validation/VAL-TASK-003-review-category-mapping-completeness.md` with evidence and sensitive-data review.

## Gate Commands

```bash
python3 scripts/pre_coding_gate.py --root .
npm run build
python3 scripts/deployment_readiness_gate.py --root .
```

## Documentation Updates

Update mapping feature, validation report, and integrations docs if behavior is defined.

## Rollback Plan

Remove any added review script or API changes and retain documentation of rejected approach.

## Agent Handoff Prompt

Review mapping completeness without exposing secrets. Do not change catalog taxonomy or approve mappings automatically.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented

## Change Note

- 2026-06-12: Draft execution plan created from backlog item.
- 2026-06-13: Implemented service-local mapping validation and documented production-data and deployment gates.
