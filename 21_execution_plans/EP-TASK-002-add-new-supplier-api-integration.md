# EP-TASK-002: Add New Supplier API Integration

```yaml
id: EP-TASK-002
status: draft
source_task: ../11_tasks/TASK-002-add-new-supplier-api-integration.md
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-001-supplier-api-integration.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-002.md
```

## Metadata

Task: `TASK-002`. Lifecycle state: draft. Must be reviewed before coding.

## Upstream Traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-002.md`

## Goal Impact

Adds supplier-specific ingestion capability while preserving validation and idempotency constraints.

## Project Invariants

- Keep credentials out of source/docs/prompts/logs.
- Validate supplier data before catalog writes.
- Preserve idempotent import re-runs.
- Respect category mapping gaps.

## Sensitive-Data Handling

Use environment-managed credentials only. Tests and docs must use synthetic or masked values. Errors must not include tokens, passwords, API keys, or raw sensitive payloads.

## Contract Validation Plan

Document supplier source contract, transformed internal representation, and downstream catalog/warehouse payload expectations before implementation. Add validation evidence to a new validation report.

## Replay/Determinism Plan

Define how the integration identifies repeated records, avoids duplicate writes, and records job counters deterministically enough for safe retries.

## Scope

One supplier-specific integration after supplier identity and contract are provided by the owner.

## Non-Goals

Broad adapter framework rewrite, catalog schema ownership changes, warehouse ownership changes, or secret storage changes.

## Files to Inspect

- `src/imports/imports.service.ts`
- `src/imports/import-job.entity.ts`
- `src/suppliers/supplier.entity.ts`
- `src/mappings/category-mapping.entity.ts`
- `src/app.module.ts`

## Files to Create

Supplier-specific adapter files and tests as approved during owner review.

## Files to Modify

Import service/module files and configuration files explicitly approved during owner review.

## Files That Must Not Be Modified

- `.env`
- `.env.backup*`
- `00_constitution/`
- `01_vision/`
- Kubernetes secret manifests containing real values

## Implementation Steps

1. Owner identifies supplier and source contract.
2. Document validation rules and sample synthetic payloads.
3. Add adapter and parser.
4. Add transformation validation.
5. Integrate with import job status and counters.
6. Add tests or contract checks.
7. Update validation report and audit evidence.

## Test Plan

Run `npm run build`, adapter tests, transformation validation, sensitive-data scan, and idempotency/replay checks.

## Validation Plan

Create `../12_validation/VAL-TASK-002-add-new-supplier-api-integration.md` with command evidence and review outcomes.

## Gate Commands

```bash
python3 scripts/pre_coding_gate.py --root .
npm run build
python3 scripts/deployment_readiness_gate.py --root .
```

## Documentation Updates

Update supplier-specific context package, prompt, validation report, and integration docs.

## Rollback Plan

Revert adapter, registration, and tests for the supplier integration. Preserve validation report with deviation notes.

## Agent Handoff Prompt

Implement only the reviewed supplier integration. Use synthetic data in tests and docs, preserve idempotency, and do not write to catalog without validation.

## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented

## Change Note

- 2026-06-12: Draft execution plan created from backlog item.
