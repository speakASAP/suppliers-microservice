# Agents: suppliers-microservice

## Remote-First Working Rule
All implementation and orchestration work for this project must happen on remote `alfares` in `/home/ssf/Documents/Github/suppliers-microservice`.

## Intent Preservation
Use the Suppliers Intent Preservation System for all future work. Read `BUSINESS.md`, `SYSTEM.md`, `README.md`, `TASKS.md`, `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, and all files under `docs/orchestrator/` before implementation.

Before source edits, create or update goal-specific execution, context, coding-prompt, and validation artifacts under `implementation-goals/` or `docs/intent-preservation/`. Run the pre-coding gate and block on unresolved execution-critical gaps.

Preserved intent: Suppliers is the controlled supplier import service. It owns supplier connection metadata, scheduled import jobs, supplier-to-catalog category mappings, supplier payload validation, and idempotent import orchestration into Catalog and Warehouse. It must never push supplier data to Catalog without validation, leak supplier credentials, create duplicate import effects on retry, or take over Catalog product truth, Warehouse stock truth, Auth identity, Logging storage, or marketplace ownership.

## Required Gates
Future coding requires upstream traceability, invariant impact review, sensitive-data classification, supplier-credential handling review, import idempotency and replay review, Catalog and Warehouse contract impact review, explicit validation commands, and readiness evidence.

Do not code when supplier credential handling, payload validation, Catalog write safety, Warehouse stock update safety, idempotency, production mutation, or deployment approval is unclear.

## Parallel Planning Default
Planning must maximize safe use of parallel Codex sessions and agents. Split work into agent-ready goals with objective, scope, dependencies, blockers, shared-resource conflicts, validation evidence, and start status. Publish execution waves before implementation:

- Wave 0: discovery, contracts, shared interfaces, schema decisions, owner approvals, and runtime prerequisites.
- Wave 1+: independent implementation, tests, documentation, and validation chunks.

Do not assign two agents to edit the same source file, migration, runtime manifest, validation report, deployment artifact, or production resource at the same time. Runtime mutation, deployment, secret inspection, production import, Catalog writes, Warehouse stock mutation, and cleanup still require explicit owner approval.

## Active Agents
<!-- Coordinator-maintained -->
None.
