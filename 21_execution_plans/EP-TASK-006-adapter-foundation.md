# EP-TASK-006: Implement Supplier Integration From Empty Production State

```yaml
id: EP-TASK-006
status: pending
source_task: ../11_tasks/TASK-006-adapter-foundation.md
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-001-supplier-api-integration.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-006.md
```

## Metadata

Task: `TASK-006`. Lifecycle state: pending. Owner requested checking production and the Suppliers codebase for a supplier contract; none was found, so this plan creates the suppliers-owned contract-first implementation path.

## Upstream Traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../11_tasks/TASK-002-add-new-supplier-api-integration.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-006.md`

## Goal Impact

Adds the missing supplier integration foundation while preserving the requirement that real supplier details come from an approved contract rather than assumptions.

## Project Invariants

Keep credentials out of source, docs, prompts, logs, and reports. Validate supplier payloads before Catalog writes. Preserve deterministic import retries. Respect category mapping gaps and Warehouse mutation approval gates.

## Sensitive-Data Handling

Use synthetic examples only. Do not print, commit, or document decoded credentials, private supplier endpoints, raw production payloads, real supplier identifiers, Catalog payloads, or Warehouse stock payloads. Runtime credential values must remain environment or secret-manager managed.

## Contract Validation Plan

Create `../docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md` and validate that it requires supplier identity, source type, endpoint description, auth reference names, pagination/download rules, product fields, stock fields, category fields, replay identifiers, error handling, and synthetic samples.

## Replay/Determinism Plan

Adapter contract must require deterministic source record identifiers and import replay keys. Synthetic validation must prove duplicate adapter-backed runs reuse or block work according to the existing import idempotency rules.

## Scope

Implement contract-first adapter infrastructure and synthetic validation inside `suppliers-microservice`. Real supplier adapter work remains blocked until a real supplier contract is supplied.

## Non-Goals

Real supplier API calls, production supplier payload queries, decoded secret inspection, Catalog writes, Warehouse stock mutation, broad adapter framework rewrite outside Suppliers, database ownership changes, or Kubernetes secret changes.

## Files to Inspect

- `src/imports/imports.service.ts`
- `src/imports/import-validation.ts`
- `src/imports/import-job.entity.ts`
- `src/suppliers/supplier.entity.ts`
- `src/suppliers/dto/supplier.dto.ts`
- `src/mappings/mappings.service.ts`

## Files to Create

- `docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md`
- Suppliers-owned TypeScript files for adapter contract and registry, with exact paths chosen during implementation
- `12_validation/VAL-TASK-006-adapter-foundation.md`

## Files to Modify

- `src/imports/imports.service.ts` if import execution needs missing-adapter handling or registry wiring
- `src/imports/imports.module.ts` if adapter providers are registered through Nest dependency injection
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `TASKS.md`
- `STATE.json`

## Files That Must Not Be Modified

- `.env`
- `.env.backup*`
- `00_constitution/`
- `01_vision/`
- Kubernetes secret manifests containing real values
- Catalog, Warehouse, Auth, or Logging repositories

## Implementation Steps

1. Add the supplier contract template with required owner-fillable fields and synthetic-only example guidance.
2. Add adapter interface types for metadata, fetch/parse boundary, normalized product/stock output, validation result, and deterministic replay identifiers.
3. Add adapter registry and safe missing-adapter behavior.
4. Add synthetic adapter or contract-check fixture only.
5. Wire import execution to registry output without downstream Catalog or Warehouse mutation.
6. Add focused validation checks for missing adapter, malformed synthetic payload, deterministic replay, and redacted errors.
7. Update validation and status artifacts.

## Test Plan

Run `npm run build`, adapter contract checks, synthetic malformed-payload checks, replay/idempotency checks, sensitive-data scan, strict documentation audit, and deployment readiness gate.

## Validation Plan

Update `../12_validation/VAL-TASK-006-adapter-foundation.md` with command evidence, discovery evidence, contract review, sensitive-data review, replay/idempotency evidence, passed criteria, failed criteria, and deviations.

## Gate Commands

```bash
python3 scripts/pre_coding_gate.py --root .
npm run build
npm audit --json
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
python3 scripts/deployment_readiness_gate.py --root .
```

## Documentation Updates

Update task, execution plan, validation report, context package, graph, goal-impact record, status, implementation state, task backlog, and state JSON.

## Rollback Plan

Revert adapter infrastructure, registry wiring, synthetic fixtures, contract template, and task-specific docs. Preserve any status entry documenting why the implementation was rolled back.

## Agent Handoff Prompt

Implement TASK-006 inside `suppliers-microservice`. Start with contract template and adapter infrastructure. Use synthetic data only, do not invent real supplier details, preserve idempotency and validation gates, and do not write to Catalog or mutate Warehouse.

## Completion Checklist

- [ ] Contract template added
- [ ] Adapter interface added
- [ ] Adapter registry added
- [ ] Missing-adapter behavior validated
- [ ] Synthetic adapter validation completed
- [ ] Replay/idempotency evidence recorded
- [ ] Sensitive-data scan passed
- [ ] Build and gates passed
- [ ] Documentation state updated

## Change Note

- 2026-06-13: Execution plan created after no existing supplier contract was found.
