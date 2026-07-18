# TASK-005: Operational Smoke And Documentation Ingestion

```yaml
id: TASK-005
status: completed
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../10_features/FEAT-001-supplier-api-integration.md
  - ../docs/orchestrator/GOALS.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-005.md
execution_plan:
  - ../21_execution_plans/EP-TASK-005-goal-6.md
```

## Objective

Run operational smoke checks and prepare documentation ingestion evidence for the Suppliers Intent Preservation System without changing runtime behavior or exposing sensitive operational data.

## Upstream Links

- `../01_vision/VISION.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../17_governance/PROJECT_INVARIANTS.md`
- `../docs/orchestrator/GOALS.md`
- `../docs/orchestrator/READINESS_GATES.md`

## Goal Impact

Confirms the service can still build and answer health checks after prior implementation goals, then makes current Suppliers IPS documentation available for retrieval when DocsRAG ingestion tooling and credentials are available.

## Project Invariant Impact

Strengthens `SUPPLIERS-INV-008`, `SUPPLIERS-INV-009`, and `SUPPLIERS-INV-010` by requiring owner-approved operational checks, sanitized smoke evidence, and continuation-state updates.

## Sensitive-Data Classification

Classification: sensitive by domain; none or synthetic only for validation artifacts. Do not include secrets, private endpoints, authorization headers, raw supplier payloads, production supplier records, real customer identifiers, or unmasked operational exports.

## Contract/Schema Impact

No API, schema, database, Catalog, Warehouse, Auth, or Logging contract changes are allowed in this goal.

## Replay/Determinism Impact

No import execution or downstream mutation is allowed. Smoke checks must be read-only and replay-safe.

## Scope

- Run `npm run build` and available automated tests or document that no test script exists.
- Run strict documentation and readiness gates.
- Verify health endpoint only as a read-only operational smoke check.
- Locate available DocsRAG ingestion tooling and trigger ingestion only if credentials and commands are already available in approved operational context.
- Verify retrieval returns current Suppliers IPS docs when ingestion/retrieval tooling is available.
- Record blocked ingestion or retrieval steps explicitly when tooling or credentials are unavailable.

## Non-Goals

Runtime source edits, database migrations, deployment, production imports, supplier API calls, Catalog writes, Warehouse stock mutations, credential changes, or raw production data inspection.

## Acceptance Criteria

- [x] Build command has recorded evidence.
- [x] Available tests have recorded evidence, or absence of a test script is documented.
- [x] Health smoke check result is recorded without secrets or production payloads.
- [x] DocsRAG ingestion attempt or blocker is recorded.
- [x] Retrieval verification attempt or blocker is recorded.
- [x] Documentation gates pass or all failures are explicitly documented.

## Required Context

- `../docs/orchestrator/GOALS.md`
- `../docs/orchestrator/STATUS.md`
- `../docs/orchestrator/READINESS_GATES.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../21_execution_plans/EP-TASK-005-goal-6.md`

## Validation Task

Update `../12_validation/VAL-TASK-005-goal-6.md` with build, test, health, DocsRAG ingestion/retrieval, gate, and sensitive-data evidence.

## Required Gates

Pre-coding gate before operational work, strict documentation audit, deployment-readiness gate, and sanitized validation report before completion.

## Execution Plan Requirement

This task must remain read-only operational validation. Any migration, deployment, production import, or downstream mutation requires a later owner-approved plan.

## Change Note

- 2026-06-13: Task created for Goal 6 operational smoke and documentation ingestion.

- 2026-06-13: Goal 6 validation passed; DocsRAG ingestion and retrieval verified.
