# EP-TASK-004: Review Warehouse Stock Update Boundary

```yaml
id: EP-TASK-004
status: implemented
source_task: ../11_tasks/TASK-004-review-warehouse-stock-update-boundary.md
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-001-supplier-api-integration.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-004.md
```

## Metadata

Task: `TASK-004`. Lifecycle state: approved for a service-local boundary slice only. Production stock verification, Warehouse writes, migration execution, and deployment remain owner-approval gated.

## Upstream Traceability

- `../10_features/FEAT-001-supplier-api-integration.md`
- `../05_subsystems/SUB-002-import-job-runner.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-004.md`

## Goal Impact

Prevents unvalidated supplier stock data from becoming a Warehouse mutation while preserving a future replay-safe handoff contract.

## Project Invariants

Preserves Warehouse stock ownership, validation-before-Warehouse-update, idempotent import behavior, production mutation approval gates, observable sanitized failures, and continuation state.

## Sensitive-Data Handling

Use synthetic stock candidates only. Do not record production supplier SKUs, stock quantities, private endpoints, credentials, raw payloads, or Warehouse mutation payloads.

## Contract Validation Plan

The current service has no Warehouse update client. Add only a normalized stock-boundary validator and import-job evidence fields: validation status, validation errors, actor, reason, idempotency key, approval state, and mutation-attempt marker.

## Replay/Determinism Plan

Every validated stock-boundary decision is tied to the import job idempotency key. Duplicate import-job replays must reuse the same job and must not trigger new stock effects.

## Scope

Identify current and intended Warehouse update paths, add service-local stock-boundary validation, record job evidence, and document failure behavior.

## Non-Goals

Warehouse client calls, production stock mutation, production stock verification, production supplier payload queries, migration execution, deployment, and supplier-specific adapter work.

## Files to Inspect

- `src/imports/imports.service.ts`
- `src/imports/import-job.entity.ts`
- `src/imports/import-validation.ts`
- `src/imports/dto/import-run.dto.ts`
- `src/database/migrations/`

## Files to Create

- `src/database/migrations/202606130002-import-job-warehouse-stock-boundary.sql`
- `12_validation/VAL-TASK-004-review-warehouse-stock-update-boundary.md`
- `13_context_packages/CP-TASK-004-review-warehouse-stock-update-boundary.md`
- `14_prompts/PROMPT-TASK-004-review-warehouse-stock-update-boundary.md`

## Files to Modify

- `src/imports/import-job.entity.ts`
- `src/imports/import-validation.ts`
- `src/imports/imports.service.ts`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/intent-preservation/TRACEABILITY_MATRIX.md`
- `implementation-goals/README.md`
- `implementation-goals/GOAL-05-warehouse-stock-update-boundary.md`
- `16_operations/INTEGRATIONS.md`
- `TASKS.md`
- `STATE.json`

## Files That Must Not Be Modified

- `.env`
- `.env.backup*`
- `00_constitution/`
- `01_vision/`

## Implementation Steps

1. Confirm no current Warehouse mutation path exists.
2. Add an unapplied migration artifact for import-job Warehouse-boundary evidence columns.
3. Add a synthetic-safe stock candidate validator.
4. Record Warehouse-boundary evidence during import execution without calling Warehouse.
5. Validate malformed synthetic stock candidates and idempotency metadata behavior.
6. Update status and validation evidence.

## Test Plan

Run `npm run build` and a synthetic Node check against compiled validation code. No production data or downstream service call is allowed.

## Validation Plan

Update `../12_validation/VAL-TASK-004-review-warehouse-stock-update-boundary.md` with gate, build, synthetic validator, and sensitive-data evidence.

## Gate Commands

```bash
python3 scripts/pre_coding_gate.py --root .
npm run build
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
python3 scripts/deployment_readiness_gate.py --root .
```

## Documentation Updates

Update Goal 5 status, integration rules, traceability matrix, implementation state, and task completion evidence.

## Rollback Plan

Remove the validator additions, import-job evidence fields, and migration artifact. Keep the documented boundary decision if runtime changes are reverted.

## Agent Handoff Prompt

Implement only the service-local Warehouse stock-boundary slice. Do not call Warehouse, mutate stock, deploy, query production payloads, or expose sensitive stock data.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented

## Change Note

- 2026-06-13: Execution plan created for Goal 5 service-local boundary slice.
- 2026-06-13: Implemented service-local Warehouse stock-boundary validation; production migration and deployment remain owner-approval gated.
