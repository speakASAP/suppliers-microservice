# EP-SUP-G7 - Warehouse Reconciliation Client

Metadata:
- id: EP-SUP-G7
- status: validated
- goal_id: SUP-G7
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: complete

## Upstream Traceability

- implementation-goals/GOAL-07-warehouse-reconciliation-client.md
- BUSINESS.md
- SYSTEM.md
- Warehouse supplier reconciliation contract in warehouse-microservice

## Goal Impact

Completes the controlled Suppliers-to-Warehouse stock flow needed for virtual supplier stock visibility. Supplier stock can enter Warehouse supplier/dropship locations only after Suppliers validation and explicit mutation approval.

## Project Invariants

- Suppliers owns supplier import orchestration and validation.
- Warehouse owns stock quantities, reservations, movements, locations, and availability.
- Catalog owns product identity and sellable product truth.
- Supplier credentials stay in runtime secret references only.
- Import jobs must be idempotent and safe to replay.

## Sensitive-Data Handling

No real supplier payloads, credentials, tokens, customer data, or production samples. Tests use synthetic candidate objects. Warehouse service token is read from environment and never printed.

## Contract Validation Plan

Use Warehouse `POST /api/supplier-reconciliations` request shape: supplierId, warehouseId, productId, quantity, externalReference, actor, observedAt. The client must send Authorization bearer token from runtime env. No response secrets are expected or persisted.

## Replay/Determinism Plan

External reference is derived from import job idempotency key plus supplier SKU/product/warehouse identity. Duplicate job replays already return `shouldRun: false`; Warehouse also enforces unique reconciliation references.

## Scope

- src/imports/import-validation.ts
- src/imports/imports.service.ts
- docs/intent-preservation validation artifacts
- implementation-goals/README.md
- docs/orchestrator/GOALS.md
- docs/orchestrator/STATUS.md
- docs/IMPLEMENTATION_STATE.md
- TASKS.md
- STATE.json

## Non-Goals

No production mutation, no deployment, no supplier API adapter, no Catalog writes, no Warehouse source changes.

## Files To Inspect

- src/imports/imports.service.ts
- src/imports/import-validation.ts
- src/imports/import-job.entity.ts
- src/imports/dto/import-run.dto.ts
- Warehouse supplier reconciliation DTO

## Files To Create

- implementation-goals/GOAL-07-warehouse-reconciliation-client.md
- docs/intent-preservation/execution-plans/EP-SUP-G7.md
- docs/intent-preservation/context-packages/CP-SUP-G7.md
- docs/intent-preservation/coding-prompts/PROMPT-SUP-G7.md
- docs/intent-preservation/validation-reports/VAL-SUP-G7.md

## Files To Modify

- src/imports/import-validation.ts
- src/imports/imports.service.ts
- implementation-goals/README.md
- docs/orchestrator/GOALS.md
- docs/orchestrator/STATUS.md
- docs/IMPLEMENTATION_STATE.md
- TASKS.md
- STATE.json

## Files That Must Not Be Modified

- BUSINESS.md
- `.env` or secret files
- Production Kubernetes secrets
- Warehouse and Catalog repositories in this Suppliers slice

## Implementation Steps

1. Define `NormalizedWarehouseStockCandidate` in import validation.
2. Require supplierSku, productId, warehouseId, non-negative stockQuantity, and optional observedAt for stock candidates.
3. Add approved mutation path in ImportsService that calls Warehouse supplier reconciliation for valid candidates only.
4. Keep default import run using an empty normalized payload and mutation approval false, so production behavior remains non-mutating unless called with approved candidate data by future adapter code.
5. Add synthetic exported helper methods or validation script coverage for blocked and approved paths.
6. Update validation and state docs.

## Test Plan

Because package.json has no test script, validate with `npm run build` plus focused synthetic TypeScript/Node checks against compiled code after build.

## Validation Plan

- python3 scripts/pre_coding_gate.py --root .
- npm run build
- node-based synthetic validation for `validateWarehouseStockUpdateBoundary`
- node-based synthetic validation for ImportsService approved Warehouse reconciliation client path with mocked repositories and HttpService
- python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
- python3 scripts/deployment_readiness_gate.py --root .
- git diff --check

## Rollback Plan

Revert SUP-G7 source/docs changes. No migration or data rollback required.

## Agent Handoff Prompt

Implement SUP-G7: add a Warehouse supplier reconciliation client path in Suppliers that is validation-first, idempotency-keyed, environment-token based, and mutation-approved only. Do not deploy or mutate production stock.
