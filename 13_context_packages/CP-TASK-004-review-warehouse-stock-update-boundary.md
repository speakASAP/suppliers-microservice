# CP-TASK-004: Review Warehouse Stock Update Boundary

```yaml
id: CP-TASK-004
status: implemented
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../14_prompts/PROMPT-TASK-004-review-warehouse-stock-update-boundary.md
  - ../21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md
downstream:
  - ../12_validation/VAL-TASK-004-review-warehouse-stock-update-boundary.md
related_adrs:
  - ../07_decisions/ADR-001-adopt-intent-preservation-system.md
```

## Target task

TASK-004: `../11_tasks/TASK-004-review-warehouse-stock-update-boundary.md`

## Upstream traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../05_subsystems/SUB-002-import-job-runner.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-004.md`

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
- Production stock quantities
- Catalog write payloads
- Warehouse stock mutation payloads

## Constraints

No Warehouse client, production stock mutation, production stock verification, production supplier payload query, credential exposure, migration execution, deployment, or supplier-specific adapter work.

## Agent prompt

Implement only the Goal 5 service-local Warehouse stock-boundary validation and import-job evidence behavior using synthetic validation evidence.

## Validation instructions

Run `python3 scripts/pre_coding_gate.py --root .`, `npm run build`, a synthetic compiled-validator check, `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues`, and `python3 scripts/deployment_readiness_gate.py --root .` before completion.

## Objective

Make stock-boundary failure behavior explicit before any future Warehouse update path exists.

## Required Context

- `BUSINESS.md`: supplier imports include stock, but validation is required before downstream effects.
- `docs/orchestrator/PROJECT_INVARIANTS.md`: Warehouse owns stock truth; production stock mutation requires owner approval.
- `21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md`: allowed files, non-goals, and validation commands.

## Implementation Boundary

Allowed source work is limited to stock-boundary validation, import-job evidence fields, and an unapplied migration artifact. Warehouse writes and production verification are out of scope.

## Validation Context

Use synthetic supplier IDs, SKUs, and quantities only. Evidence must not include credentials, private supplier endpoints, raw supplier payloads, Catalog write payloads, Warehouse stock mutation payloads, or production quantities.

## Change Note

- 2026-06-13: Added context package for Goal 5 graph compliance.
