# Goal 7 - Warehouse Reconciliation Client

Metadata:
- id: SUP-G7
- status: done
- owner: suppliers-owner
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: complete
- upstream: BUSINESS.md, SYSTEM.md, docs/IMPLEMENTATION_STATE.md, docs/orchestrator/GOALS.md, /home/ssf/Documents/Github/warehouse-microservice/docs/contracts/availability-contracts.md
- downstream: docs/intent-preservation/execution-plans/EP-SUP-G7.md, docs/intent-preservation/context-packages/CP-SUP-G7.md, docs/intent-preservation/coding-prompts/PROMPT-SUP-G7.md, docs/intent-preservation/validation-reports/VAL-SUP-G7.md

## Intent

Suppliers should become the controlled orchestration point that can turn validated supplier stock candidates into Warehouse supplier/dropship reconciliation calls. Warehouse remains stock authority, Catalog remains product truth, and Suppliers remains supplier import orchestration.

## Scope

- Define normalized supplier stock candidate fields required for Warehouse reconciliation.
- Add a Warehouse reconciliation client that calls `POST /api/supplier-reconciliations` with a service token from runtime environment.
- Keep mutation opt-in: no Warehouse call unless the import run is explicitly approved for Warehouse mutation.
- Preserve idempotency using the import job idempotency key plus supplier SKU/product/warehouse reference.
- Record import-job evidence for attempted/approved mutation and validation status.

## Non-Goals

- No supplier-specific external API adapter.
- No Catalog product write.
- No Warehouse schema change.
- No production import or production stock mutation during source validation.
- No supplier credentials in docs, tests, logs, or examples.
- No deployment without owner approval.

## Acceptance Criteria

- Invalid stock candidates are blocked before Warehouse calls.
- Unapproved mutation attempts are blocked and recorded.
- Approved synthetic candidates call Warehouse reconciliation with supplierId, warehouseId, productId, quantity, externalReference, actor, and observedAt.
- Warehouse dependency errors mark the import failed without retrying duplicate effects.
- `npm run build` and synthetic validation scripts pass.
