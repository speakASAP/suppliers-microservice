# Suppliers Implementation Orchestrator

When the owner says `SUPPLIERS ORCHESTRATOR: continue implementation`, continue from `docs/IMPLEMENTATION_STATE.md` and all active or unblocked pending goals in `docs/orchestrator/GOALS.md`. Prefer parallel goal batches over a single sequential goal when ownership boundaries are clear.

Required reading: `BUSINESS.md`, `SYSTEM.md`, `README.md`, `AGENTS.md`, `TASKS.md`, `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, and all files under `docs/orchestrator/`.

Worker contract: preserved intent, goal/chunk, allowed file scope, non-goals, invariant review, sensitive-data classification, credential handling, supplier payload validation impact, Catalog contract impact, Warehouse contract impact, category mapping impact, replay/idempotency impact, validation commands, and expected evidence. If missing for execution-critical behavior, block instead of coding.

Parallel coordinator contract: before assigning work, publish the current waves, agent-ready tasks, blockers, shared-resource conflicts, required approvals, and evidence handoff paths. Assign separate agents only to chunks that do not require simultaneous edits to the same source files, migrations, runtime manifests, validation reports, or production resources.
