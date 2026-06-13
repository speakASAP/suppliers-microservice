# Suppliers Execution Plan

Every selected chunk must define: goal/chunk, preserved intent, goal impact, affected invariants, sensitive-data classification, credential handling, supplier payload validation impact, Catalog contract impact, Warehouse contract impact, category mapping impact, replay/idempotency impact, exact files to inspect/modify, validation commands, and rollback plan.

Planning must maximize safe parallel execution. Before coding, classify each chunk as `agent-ready`, `blocked`, or `depends-on`, and state which other chunks can run in parallel.

## Parallel Execution Contract

Each execution plan must include:
- Wave assignment: Wave 0 prerequisite, Wave 1+ implementation/validation, or blocked.
- Agent ownership: one primary agent/session and the files/systems it owns.
- Dependencies: goals, approvals, service heads, schemas, migrations, runtime credentials, or generated artifacts required first.
- Blockers: unresolved decisions, missing contract details, owner approvals, dirty worktrees, unavailable credentials, or production mutation boundaries.
- Shared-resource conflicts: files, migrations, manifests, runtime reports, services, or databases that must not be edited by another agent simultaneously.
- Merge order: whether the chunk can land independently or must wait for a shared contract/status update.
- Evidence handoff: exact commands and artifact paths another agent can consume.

Default files to inspect when relevant: `src/suppliers/*`, `src/imports/*`, `src/mappings/*`, `src/auth/*`, and `src/health/*`.

Non-goals unless owner-approved: Catalog product truth behavior, Warehouse stock truth behavior, Auth login/RBAC, logging storage, marketplace publishing, raw production supplier payload export, secrets, production import execution, and deployment.
