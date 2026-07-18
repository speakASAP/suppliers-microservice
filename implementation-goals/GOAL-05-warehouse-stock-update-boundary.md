# Goal 5 - Warehouse Stock Update Boundary

Status: done. Owner: suppliers-owner. Created: 2026-06-13. Completed: 2026-06-13.

## Intent

Supplier imports may carry stock data, but Warehouse remains the central stock authority. Suppliers must validate stock candidates and record replay-safe evidence before any future Warehouse mutation point.

## Selected Slice

Implement the nearest safe service-local slice only: identify that no current Warehouse mutation path exists, add stock-boundary validation and import-job evidence, document failure behavior, and keep production stock verification owner-approval gated.

## Scope

- Add a Warehouse stock-boundary validator for normalized stock candidates.
- Record actor, reason, idempotency key, validation status, sanitized validation errors, approval state, and mutation-attempt marker on import jobs.
- Add an unapplied database migration artifact for the new import-job evidence columns.
- Add focused synthetic validation evidence.

## Non-Goals

No Warehouse client, Warehouse stock mutation, production supplier payload query, production stock verification, migration execution, deployment, or supplier-specific adapter implementation.

## File Scope

src/imports/import-validation.ts, src/imports/import-job.entity.ts, src/imports/imports.service.ts, src/database/migrations/202606130002-import-job-warehouse-stock-boundary.sql, docs/11_tasks/TASK-004-review-warehouse-stock-update-boundary.md, docs/12_validation/VAL-TASK-004-review-warehouse-stock-update-boundary.md, docs/13_context_packages/CP-TASK-004-review-warehouse-stock-update-boundary.md, docs/14_prompts/PROMPT-TASK-004-review-warehouse-stock-update-boundary.md, docs/16_operations/INTEGRATIONS.md, docs/21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md, docs/22_goal_impact/GOAL-IMPACT-TASK-004.md, docs/orchestrator/GOALS.md, docs/orchestrator/STATUS.md, docs/IMPLEMENTATION_STATE.md, docs/12_validation/TRACEABILITY_MATRIX.md, TASKS.md, STATE.json.

## Invariant Review

`SUPPLIERS-INV-002` and `SUPPLIERS-INV-007` are preserved because Warehouse remains the stock authority. `SUPPLIERS-INV-004` and `SUPPLIERS-INV-005` are strengthened by validation and idempotency evidence. `SUPPLIERS-INV-008` is preserved because no production mutation, migration execution, or deployment is performed without owner approval.

## Sensitive-Data Classification

Classification: sensitive by domain; synthetic only for validation. Validation evidence must avoid real supplier SKUs, production quantities, raw payloads, private endpoints, and credentials.

## Warehouse Boundary

Current path: Suppliers records import jobs and validates normalized payload candidates; it does not call Warehouse. Intended future path: only a validated, owner-approved integration may hand stock candidates to Warehouse with actor, reason, idempotency key, and sanitized failure evidence.

## Failure Behavior

Malformed stock candidates fail the Warehouse-boundary validation and keep Warehouse update approval disabled. Failures are recorded as sanitized field-level errors; no raw supplier payload or production quantity is written to reports.

## Validation Commands

- python3 scripts/pre_coding_gate.py --root .
- npm run build
- node -e synthetic compiled-validator check
- python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
- python3 scripts/deployment_readiness_gate.py --root .

## Decision

Proceed with service-local boundary implementation only. Production stock verification is split into a later owner-approved chunk.

## Evidence

- python3 scripts/pre_coding_gate.py --root . passed before source edits.
- npm run build passed.
- Synthetic compiled-validator check passed for malformed stock candidates, unapproved mutation attempts, and a valid synthetic candidate.
- Strict documentation audit passed. Deployment-readiness gate passed.

## Next Action

Proceed to Goal 6 - Operational Smoke And Documentation Ingestion. Apply the Goal 5 migration and deploy only after owner approval.
