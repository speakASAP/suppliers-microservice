# Suppliers Implementation Plan

Plan work for parallel execution by default. The coordinator must split work into independent goals that can be started in separate Codex sessions with separate agents, while preserving owner approvals, sensitive-data boundaries, and cross-service contract gates.

Workflow: read source-of-truth docs, query DocsRAG when available, select all unblocked goals that do not share unsafe mutable files or runtime side effects, create goal artifacts, run pre-coding gate, assign one owner per goal/session, validate independently, append `docs/orchestrator/STATUS.md`, update `docs/IMPLEMENTATION_STATE.md`, `TASKS.md`, and `STATE.json` when state changes.

## Parallel Planning Rules

- Prefer agent-ready goal batches over a purely sequential checklist.
- Group work into waves:
  - Wave 0: discovery, contracts, shared interfaces, schema decisions, deployment approvals, and other prerequisites.
  - Wave 1+: independent implementation, tests, documentation, and validation goals.
- Every goal must state objective, expected output, file/system scope, dependencies, blockers, validation evidence, and whether it can start now.
- Two agents must not edit the same source file, migration, runtime manifest, or validation artifact at the same time unless one goal explicitly owns the shared contract and the other goals wait.
- Runtime mutation, deployment, secret inspection, production import, Catalog writes, Warehouse stock mutation, and cleanup remain owner-approval gated even when planning is parallel.
- If the next work can run in parallel, the coordinator must publish an "Agent-Ready Parallel Tasks" list before coding starts.

## Agent-Ready Parallel Tasks

Current next work can be parallelized only around source/doc validation and blocked discovery. Runtime completion remains gated by owner-approved deployment and guarded smoke execution.

| Agent | Goal | Can start now | Scope | Blockers | Required evidence |
| --- | --- | --- | --- | --- | --- |
| A | Current-head runtime readiness regeneration | yes | Regenerate handoff/readiness/deployment templates from clean Warehouse, Catalog, and Suppliers heads under `/tmp`; do not deploy or mutate production | None if all three worktrees are clean; block on dirty cross-service worktrees | Fresh manifest/template hashes, clean-head SHAs, preflight output |
| B | Cross-service source preflight verification | yes | Run non-mutating Suppliers cross-service preflight and strict doc audit against current Warehouse/Catalog/Suppliers heads | Block on source drift or missing sibling repositories | Preflight, strict doc audit, and whitespace evidence |
| C | Runtime deployment and guarded smoke | no | Deploy current heads and run guarded stock traceability runtime evidence flow | Requires owner approval, current deployment evidence from Agent A, runtime credentials present, and no dirty worktrees | Deployment evidence JSON, runtime report, manifest, completion verifier output |
| D | Supplier-specific API adapter discovery | no | Prepare TASK-002 supplier-specific integration plan from real supplier contract details | Blocked until owner supplies supplier identity, endpoint, auth shape, payload schema, and sample sanitized contract | Reviewed execution plan with no invented supplier details |
| E | Documentation/status consolidation | yes | Update status/state after Agents A/B finish; reconcile blockers and next-wave ownership | Wait for current evidence from Agents A/B | Updated status/state with blockers and next actions |

Documentation-only validation:
```bash
find docs/orchestrator docs/intent-preservation implementation-goals -maxdepth 3 -type f -name '*.md' -print
rg '\[(MISSING|UNKNOWN):' docs/orchestrator docs/intent-preservation docs/IMPLEMENTATION_ORCHESTRATOR.md docs/IMPLEMENTATION_STATE.md implementation-goals AGENTS.md
rg -n 'Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}|(client[_-]?secret|password|private[_-]?key|api[_-]?key)\s*[:=]\s*["'"']?[A-Za-z0-9_./+=:-]{12,}' docs AGENTS.md TASKS.md implementation-goals
```
