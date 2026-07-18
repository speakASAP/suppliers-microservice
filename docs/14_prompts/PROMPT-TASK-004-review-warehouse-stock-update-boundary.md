# PROMPT-TASK-004: Review Warehouse Stock Update Boundary

```yaml
id: PROMPT-TASK-004
status: implemented
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md
downstream:
  - ../13_context_packages/CP-TASK-004-review-warehouse-stock-update-boundary.md
related_adrs:
  - ../07_decisions/ADR-001-adopt-intent-preservation-system.md
```

## Role

Implementation agent preserving Suppliers import boundaries and Warehouse stock authority.

## Task

Implement the Goal 5 service-local Warehouse stock update boundary: validate stock candidates and record import-job evidence without calling Warehouse.

## Context

Use `BUSINESS.md`, `SYSTEM.md`, `README.md`, `docs/orchestrator/*`, `docs/10_features/FEAT-001-supplier-api-integration.md`, `docs/11_tasks/TASK-004-review-warehouse-stock-update-boundary.md`, and `docs/21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md`.

## Constraints

Do not apply migrations, deploy, query production supplier payloads, expose supplier credentials, write Catalog products, call Warehouse, mutate Warehouse stock, or perform production stock verification.

## Acceptance Criteria

- Current Warehouse mutation path is documented as absent.
- Stock-boundary validator rejects malformed normalized stock candidates.
- Import jobs record Warehouse-boundary validation status, sanitized errors, actor, reason, idempotency key, approval state, and mutation-attempt marker.
- Production migration and stock verification remain owner-approval gated.

## Validation

Run `python3 scripts/pre_coding_gate.py --root .`, `npm run build`, a synthetic compiled-validator check, `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues`, and `python3 scripts/deployment_readiness_gate.py --root .`.

## Change Note

- 2026-06-13: Added for Goal 5 graph compliance and implementation traceability.
