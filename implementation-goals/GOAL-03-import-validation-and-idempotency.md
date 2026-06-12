# Goal 3 - Import Validation And Idempotency

Status: done. Owner: suppliers-owner. Created: 2026-06-12. Completed: 2026-06-12.

## Intent

Supplier imports must validate supplier and normalized payload inputs before any downstream Catalog or Warehouse write. Repeated import requests must be idempotent so retries cannot create duplicate product or stock effects.

## Selected Slice

Implement the nearest safe service-local slice only: validate the supplier boundary, create or reuse jobs by idempotency key, and record payload-validation state before any future downstream write point.

## Scope

- Validate manual/scheduled import run trigger type and idempotency key.
- Validate that the supplier exists and is active before job creation or reuse.
- Persist import job idempotency metadata and payload-validation outcome fields.
- Reuse existing jobs for duplicate supplier/idempotency-key requests.
- Add generic normalized supplier payload validation for future adapter code.
- Keep Catalog and Warehouse downstream behavior skipped.

## Non-Goals

No TASK-002 supplier-specific adapter, real supplier payload samples, private endpoints, credentials, decoded secrets, Catalog product writes, Warehouse stock mutations, production imports, or deployment.

## File Scope

src/imports/dto/import-run.dto.ts, src/imports/import-validation.ts, src/imports/import-job.entity.ts, src/imports/imports.module.ts, src/imports/imports.service.ts, src/imports/imports.controller.ts, docs/orchestrator/GOALS.md, docs/orchestrator/PLAN.md, docs/orchestrator/STATUS.md, docs/IMPLEMENTATION_STATE.md, TASKS.md, STATE.json.

## Invariant Review

SUPPLIERS-INV-001, 004, and 005 are strengthened. SUPPLIERS-INV-002, 003, 008, and 009 are preserved because this slice adds no downstream writes, no production mutation, and no sensitive samples. SUPPLIERS-INV-010 is satisfied by updating status evidence.

## Sensitive-Data Classification

Classification: sensitive by domain; synthetic only for validation. Do not add credentials, private supplier URLs, raw production supplier payloads, Catalog payloads, Warehouse payloads, or sensitive logs.

## Contract Impact

Supplier credentials are unchanged. Supplier payload validation becomes a generic normalized-item gate; supplier-specific schemas remain blocked pending owner-supplied contracts. No Catalog, Warehouse, or category mapping behavior changes in this slice.

## Idempotency And Retry Behavior

Manual imports may provide a caller idempotency key. Scheduled imports can provide deterministic scheduler keys. Duplicate supplier/idempotency-key requests return the existing job and do not enqueue duplicate work. A new logical attempt requires a new idempotency key.

## Validation Commands

- python3 scripts/pre_coding_gate.py --root .
- npm run build
- node -e validation of dist/imports/import-validation.js with synthetic payloads
- python3 scripts/deployment_readiness_gate.py --root .

## Decision

Pre-coding decision: proceed. Implementation decision: accept with follow-up for owner-approved production database migration and deployment.

## Evidence

- python3 scripts/pre_coding_gate.py --root . passed before source edits.
- npm run build passed.
- Synthetic payload validator check passed with one valid normalized item and two invalid synthetic items.
- Synthetic duplicate-run check passed with one saved job and replay metadata showing created false and shouldRun false.
- python3 scripts/deployment_readiness_gate.py --root . passed.

## Next Action

Proceed to Goal 4 - Category Mapping Completeness And Catalog Boundary. Before production deployment, add an owner-approved migration for import job idempotency and validation columns.
