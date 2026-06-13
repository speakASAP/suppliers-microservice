# TASK-004: Review Warehouse Stock Update Boundary

```yaml
id: TASK-004
status: draft
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../10_features/FEAT-001-supplier-api-integration.md
  - ../05_subsystems/SUB-002-import-job-runner.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-004.md
execution_plan:
  - ../21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md
```

## Objective

Define and enforce the service-local Warehouse stock update boundary before any supplier import can mutate stock downstream.

## Upstream Links

- `../01_vision/VISION.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../05_subsystems/SUB-002-import-job-runner.md`
- `../17_governance/PROJECT_INVARIANTS.md`

## Goal Impact

Supports automated supplier stock imports while preserving Warehouse as the central stock authority.

## Project Invariant Impact

Strengthens `SUPPLIERS-INV-002`, `SUPPLIERS-INV-004`, `SUPPLIERS-INV-005`, `SUPPLIERS-INV-007`, `SUPPLIERS-INV-008`, `SUPPLIERS-INV-009`, and `SUPPLIERS-INV-010`.

## Sensitive-Data Classification

Classification: sensitive by domain; synthetic only for validation. Do not copy production stock quantities, supplier SKUs, private endpoints, credentials, or raw supplier payloads into docs, prompts, tests, or validation evidence.

## Contract/Schema Impact

Adds service-local import-job evidence fields for Warehouse stock-boundary validation. It does not add a Warehouse mutation client or change Warehouse-owned stock records.

## Replay/Determinism Impact

High. Stock-boundary evidence must carry the import idempotency key so a future Warehouse write path can remain replay-safe.

## Scope

- Identify current and intended Warehouse update paths.
- Validate normalized stock candidates before any future Warehouse write point.
- Record actor, reason, idempotency key, and approval state as import-job evidence.
- Document stock update failure behavior.
- Keep production stock verification owner-approval gated.

## Non-Goals

Calling Warehouse, mutating production stock, querying production supplier payloads, adding supplier-specific adapters, applying migrations, or deploying without owner approval.

## Acceptance Criteria

- [ ] Current code has no Warehouse mutation path.
- [ ] Stock-boundary validation rejects malformed stock candidates.
- [ ] Import jobs record Warehouse-boundary evidence using synthetic validation.
- [ ] Build and gate checks pass.
- [ ] Production verification chunks remain owner-approval gated.

## Required Context

- `../01_vision/VISION.md`
- `../17_governance/PROJECT_INVARIANTS.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md`

## Validation Task

Update `../12_validation/VAL-TASK-004-review-warehouse-stock-update-boundary.md` with build, synthetic validator, sensitive-data, and readiness evidence.

## Required Gates

Pre-coding gate, build validation, synthetic stock-boundary validator check, and deployment-readiness gate before deployment.

## Execution Plan Requirement

This task must not enable stock mutation. Any Warehouse write path requires a later owner-approved plan.

## Change Note

- 2026-06-13: Task created for Goal 5 Warehouse stock update boundary.
