# EP-TASK-005: Operational Smoke And Documentation Ingestion

```yaml
id: EP-TASK-005
status: implemented
source_task: ../11_tasks/TASK-005-goal-6.md
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-001-supplier-api-integration.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-005.md
```

## Metadata

Task: `TASK-005`. Lifecycle state: approved for read-only operational smoke and documentation-ingestion validation. Runtime source edits, migrations, deployments, imports, and downstream writes are out of scope.

## Upstream Traceability

- `../10_features/FEAT-001-supplier-api-integration.md`
- `../docs/orchestrator/GOALS.md`
- `../docs/orchestrator/READINESS_GATES.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-005.md`

## Goal Impact

Provides operational confidence after Goals 1-5 and prepares current Suppliers IPS docs for retrieval by agent workflows.

## Project Invariants

Preserves production approval gates, sanitized observability, sensitive-data policy, and continuation-state requirements. No supplier data, Catalog writes, Warehouse mutations, or credentials are touched.

## Sensitive-Data Handling

Use command status, sanitized endpoint names, and document paths only. Do not capture tokens, headers, `.env` values, raw supplier payloads, production records, private supplier URLs, or real identifiers in reports.

## Contract Validation Plan

No service contract changes are expected. Validate existing operational contract with build and read-only health checks only.

## Replay/Determinism Plan

All commands are read-only except generated validation reports and IPS status updates. Health and retrieval checks can be repeated without import side effects.

## Scope

Run build, available tests, strict documentation audit, deployment-readiness gate, health smoke, DocsRAG ingestion if tooling and credentials are available, and DocsRAG retrieval verification if ingestion/retrieval tooling is available.

## Non-Goals

Runtime source edits, database migrations, deployment, production imports, supplier API calls, Catalog writes, Warehouse stock mutations, credential rotation, or production payload inspection.

## Files to Inspect

- `package.json`
- `scripts/`
- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/STATUS.md`
- `docs/orchestrator/READINESS_GATES.md`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- DocsRAG service documentation or scripts when discoverable from `/home/ssf/Documents/Github/docs-rag-microservice`

## Files to Create

- `docs/11_tasks/TASK-005-goal-6.md`
- `docs/12_validation/VAL-TASK-005-goal-6.md`
- `docs/13_context_packages/CP-TASK-005-goal-6.md`
- `docs/14_prompts/PROMPT-TASK-005-goal-6.md`
- `docs/21_execution_plans/EP-TASK-005-goal-6.md`
- `docs/22_goal_impact/GOAL-IMPACT-TASK-005.md`
- `implementation-goals/GOAL-06-operational-smoke-docs-ingestion.md`

## Files to Modify

- `docs/orchestrator/GOALS.md`
- `docs/orchestrator/STATUS.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/12_validation/TRACEABILITY_MATRIX.md`
- `implementation-goals/README.md`
- `TASKS.md`
- `STATE.json`

## Files That Must Not Be Modified

- `.env`
- `.env.backup*`
- `docs/00_constitution/`
- `docs/01_vision/`
- Runtime source under `src/` unless a later owner-approved corrective plan is created.

## Implementation Steps

1. Create Goal 6 IPS artifacts and mark Goal 6 active.
2. Run `python3 scripts/pre_coding_gate.py --root .`.
3. Run `npm run build`.
4. Check `package.json` for available test scripts and run only defined safe tests.
5. Run strict documentation audit.
6. Run deployment-readiness gate for `TASK-005`.
7. Perform read-only health smoke against the service endpoint if reachable from the approved remote context.
8. Inspect DocsRAG tooling and trigger ingestion only if a documented command and credentials are already available.
9. Verify retrieval only if documented tooling is available.
10. Update validation report, status, traceability, implementation state, tasks, and state JSON.

## Test Plan

Build is required. Automated tests are required only when a test script exists. Health check is read-only. DocsRAG ingestion/retrieval steps must be recorded as passed, skipped, or blocked with concrete reason.

## Validation Plan

Update `../12_validation/VAL-TASK-005-goal-6.md` with command, repository root, target artifact, status, failed checks, sensitive-data result, health result, DocsRAG ingestion/retrieval result, deviations, and next action.

## Gate Commands

```bash
python3 scripts/pre_coding_gate.py --root .
npm run build
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
python3 scripts/deployment_readiness_gate.py --root . --target TASK-005
```

## Documentation Updates

Update Goal 6 status, validation report, implementation state, traceability matrix, task completion evidence, and state JSON.

## Rollback Plan

Remove Goal 6 generated documentation artifacts and revert status-only updates. No runtime rollback is expected because source, database, deployment, and downstream systems are not modified.

## Agent Handoff Prompt

Run the Goal 6 read-only operational smoke and documentation-ingestion workflow. Do not edit runtime source, deploy, apply migrations, run imports, expose credentials, or include production payloads in evidence.

## Completion Checklist

- [ ] Artifacts created
- [ ] Pre-coding gate passed
- [ ] Build evidence recorded
- [ ] Test availability recorded
- [ ] Health smoke recorded
- [ ] DocsRAG ingestion/retrieval recorded or blocked with reason
- [ ] Documentation gates passed
- [ ] Continuation state updated

## Change Note

- 2026-06-13: Execution plan created for Goal 6 read-only operational validation.

- 2026-06-13: Goal 6 execution completed.
