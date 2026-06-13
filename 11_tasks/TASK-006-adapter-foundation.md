# TASK-006: Implement Supplier Integration From Empty Production State

```yaml
id: TASK-006
status: pending
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../10_features/FEAT-001-supplier-api-integration.md
  - ../11_tasks/TASK-002-add-new-supplier-api-integration.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-006.md
execution_plan:
  - ../21_execution_plans/EP-TASK-006-adapter-foundation.md
```

## Objective

Implement the first concrete supplier integration capability inside `suppliers-microservice` after confirming production has no supplier records, API URLs, credential references, or supplier-specific contract artifacts.

## Upstream Links

- `../01_vision/VISION.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../11_tasks/TASK-002-add-new-supplier-api-integration.md`
- `../17_governance/PROJECT_INVARIANTS.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`

## Goal Impact

Directly supports automated supplier imports by adding contract-first adapter infrastructure when no real supplier source contract exists yet. It keeps TASK-002 available for a future real supplier adapter while creating a suppliers-owned implementation path that can be validated with synthetic data.

## Project Invariant Impact

Must preserve credential secrecy, validation-before-Catalog-write, idempotent import behavior, explicit category mapping requirements, Catalog ownership boundaries, and Warehouse stock ownership boundaries.

## Sensitive-Data Classification

Classification: sensitive by domain; synthetic only for task artifacts and validation. Do not include decoded secrets, private supplier endpoints, raw production supplier payloads, production supplier records, Catalog write payloads, or Warehouse mutation payloads.

## Contract/Schema Impact

Adds a supplier contract template and adapter contract. No database schema, external supplier API, Catalog API, Warehouse API, or Kubernetes secret contract changes are included in this task unless a later owner-approved implementation step explicitly requires them.

## Replay/Determinism Impact

High. Adapter-backed imports must produce deterministic replay identifiers and must preserve existing import idempotency behavior before any downstream side effect is attempted.

## Scope

- Add `docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md`.
- Add a supplier adapter interface and registry inside Suppliers-owned code.
- Add synthetic contract/adapter validation only.
- Wire import execution to detect missing adapters safely without downstream writes.
- Record evidence for contract validation, sensitive-data review, and replay/idempotency behavior.

## Non-Goals

- Guessing a real supplier identity, private endpoint, credential shape, payload schema, category taxonomy, or production data format.
- Reading or documenting decoded credentials or raw supplier payloads.
- Writing Catalog products or mutating Warehouse stock.
- Changing Auth, Catalog, Warehouse, Logging, or database ownership boundaries.

## Acceptance Criteria

- [ ] Supplier contract template exists and lists all required fields for future real supplier onboarding.
- [ ] Adapter interface and registry are implemented in Suppliers-owned code.
- [ ] Missing adapter behavior is explicit, sanitized, and replay-safe.
- [ ] Synthetic adapter validation proves malformed payloads fail before downstream writes.
- [ ] Re-run/idempotency behavior is validated for adapter-backed imports.
- [ ] `npm run build`, sensitive-data scan, strict documentation audit, and deployment readiness gate pass.

## Required Context

- `../docs/orchestrator/INTENT.md`
- `../docs/orchestrator/PRE_CODING_GATE.md`
- `../docs/orchestrator/READINESS_GATES.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../21_execution_plans/EP-TASK-006-adapter-foundation.md`

## Validation Task

Update `../12_validation/VAL-TASK-006-adapter-foundation.md` with discovery evidence, contract-template review, adapter validation evidence, sensitive-data scan, build result, and replay/idempotency result.

## Required Gates

Pre-coding gate, contract review, sensitive-data review, replay/idempotency review, strict documentation audit, and deployment-readiness gate before any production deployment.

## Execution Plan Requirement

This task must start with contract-first adapter infrastructure and synthetic validation. A real supplier adapter must not be implemented until a supplier identity and source contract are supplied through the template and approved.

## Change Note

- 2026-06-13: Created after repository, runtime configuration, and sanitized production metadata checks found no implemented supplier-specific contract.
