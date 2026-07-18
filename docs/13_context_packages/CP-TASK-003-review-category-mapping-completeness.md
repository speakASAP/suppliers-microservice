# CP-TASK-003: Review Category Mapping Completeness

```yaml
id: CP-TASK-003
status: implemented
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../14_prompts/PROMPT-TASK-003-review-category-mapping-completeness.md
  - ../21_execution_plans/EP-TASK-003-review-category-mapping-completeness.md
downstream:
  - ../12_validation/VAL-TASK-003-review-category-mapping-completeness.md
related_adrs:
  - ../07_decisions/ADR-001-adopt-intent-preservation-system.md
```

## Target task

TASK-003: `../11_tasks/TASK-003-review-category-mapping-completeness.md`

## Upstream traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../05_subsystems/SUB-003-category-mapping.md`
- `../10_features/FEAT-002-category-mapping.md`
- `../21_execution_plans/EP-TASK-003-review-category-mapping-completeness.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-003.md`

## Included documents

- `../17_governance/PROJECT_INVARIANTS.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../03_domain_model/CORE_ENTITIES.md`
- `../docs/orchestrator/PROJECT_INVARIANTS.md`
- `../docs/orchestrator/READINESS_GATES.md`

## Excluded documents

- `.env`
- `.env.backup*`
- Raw supplier payloads
- Production credentials
- Production category dumps
- Catalog write payloads
- Warehouse stock payloads

## Constraints

No production migration execution, deployment, production supplier payload query, credential exposure, Catalog taxonomy mutation, automatic mapping approval, Catalog product write, or Warehouse stock mutation.

## Agent prompt

Prepare the Goal 3 import-job migration as a source artifact, then implement only the approved Goal 4 service-local mapping validation and completeness behavior using synthetic validation evidence.

## Validation instructions

Run `python3 scripts/pre_coding_gate.py --root .`, `npm run build`, a synthetic compiled-service mapping completeness check, and `python3 scripts/deployment_readiness_gate.py --root .` before completion.

## Objective

Implement the Goal 4 service-local category mapping completeness slice while preserving Catalog as category truth owner.

## Required Context

- `BUSINESS.md`: supplier imports use category mapping and must validate before Catalog writes.
- `docs/orchestrator/PROJECT_INVARIANTS.md`: Suppliers owns mappings; Catalog owns category truth; production mutation and deployment require owner approval.
- `docs/10_features/FEAT-002-category-mapping.md`: mapping upsert, completeness review, and missing mapping behavior.
- `docs/21_execution_plans/EP-TASK-003-review-category-mapping-completeness.md`: allowed files, non-goals, and validation commands.

## Implementation Boundary

Allowed source work is limited to mapping DTO/controller/service behavior and an unapplied migration artifact for the prior Goal 3 import-job schema gap. Production data access, migration execution, deployment, Catalog taxonomy mutation, downstream writes, and automatic mapping approval are out of scope.

## Validation Context

Use synthetic supplier IDs and category IDs only. Evidence must not include credentials, private supplier endpoints, raw supplier payloads, Catalog write payloads, Warehouse stock payloads, or production category dumps.

## Change Note

- 2026-06-13: Added context package for Goal 4 graph compliance.
