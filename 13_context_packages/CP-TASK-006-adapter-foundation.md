# CP-TASK-006: Implement Supplier Integration From Empty Production State

```yaml
id: CP-TASK-006
status: pending
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../21_execution_plans/EP-TASK-006-adapter-foundation.md
downstream:
  - ../12_validation/VAL-TASK-006-adapter-foundation.md
related_adrs:
  - ../07_decisions/ADR-001-adopt-intent-preservation-system.md
```

## Target task

TASK-006: `../11_tasks/TASK-006-adapter-foundation.md`

## Upstream traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../11_tasks/TASK-002-add-new-supplier-api-integration.md`
- `../21_execution_plans/EP-TASK-006-adapter-foundation.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-006.md`

## Included documents

- `../17_governance/PROJECT_INVARIANTS.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../docs/orchestrator/INTENT.md`
- `../docs/orchestrator/PRE_CODING_GATE.md`
- `../docs/orchestrator/READINESS_GATES.md`
- `../docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md`

## Excluded documents

- `.env`
- `.env.backup*`
- Raw supplier payloads
- Production credentials
- Authorization headers
- Private supplier endpoints
- Catalog write payloads
- Warehouse stock mutation payloads

## Constraints

No concrete supplier contract exists. Use synthetic samples only. Do not query production supplier payloads, expose credentials, or perform downstream writes.

## Agent prompt

Implement TASK-006 inside `suppliers-microservice`: add supplier contract template, adapter interface, adapter registry, synthetic validation checks, and safe import wiring. Do not invent real supplier details.

## Validation instructions

Run pre-coding gate, build, npm audit, synthetic adapter checks, sensitive-data scan, strict documentation audit, deployment-readiness gate, and replay/idempotency validation.

## Objective

Turn the empty production supplier state into an implementable contract-first adapter foundation for Suppliers.

## Required Context

- `TASK-006` task document.
- `EP-TASK-006` execution plan.
- Supplier sensitive-data policy and project invariants.

## Implementation Boundary

Implementation is limited to Suppliers-owned contract and adapter infrastructure. Real supplier adapter details must come from a later owner-supplied contract.

## Validation Context

Evidence may include command names, pass/fail status, sanitized aggregate counts, synthetic payload labels, and document paths. Evidence must not include secrets, private endpoints, or raw supplier payloads.

## Change Note

- 2026-06-13: Context package created for TASK-006.
