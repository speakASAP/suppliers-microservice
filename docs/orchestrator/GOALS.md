# Suppliers Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

Planning mode: maximize safe parallel execution. A goal is agent-ready only when it lists dependencies, blockers, owned files/systems, validation evidence, and whether it can start without waiting for another goal.

## Goal 1 - Intent Preservation System
Status: done

Chunks: search existing docs/source, add IPS docs, add templates/state, update `AGENTS.md`, record validation evidence.

## Goal 2 - Supplier Contract And Credential Safety
Status: done
- [x] Review supplier create/update payload handling and credential persistence expectations.
- [x] Define whether `apiCredentials` may remain in database JSON or must become runtime secret references.
- [x] Add DTO validation for supplier records, API type, URL, schedule, and credential references.
- [x] Verify read responses do not expose sensitive credential fields.

## Goal 3 - Import Validation And Idempotency
Status: done
- [x] Define supplier payload validation before Catalog writes.
- [x] Define idempotency key and retry behavior for manual and scheduled imports.
- [x] Record import job state transitions and failure semantics.
- [x] Add synthetic duplicate-run validation evidence.

## Goal 4 - Category Mapping Completeness And Catalog Boundary
Status: done
- [x] Audit mapping create/update semantics.
- [x] Define missing, stale, or ambiguous mapping behavior before import.
- [x] Add validation for mapping identifiers and duplicate mapping updates.
- [x] Record Catalog ownership boundary and consumer compatibility risks.

## Goal 5 - Warehouse Stock Update Boundary
Status: done
- [x] Identify current and intended Warehouse update paths.
- [x] Define stock payload validation, actor, reason, and idempotency evidence.
- [x] Add focused tests or contract notes for stock update failure behavior.
- [x] Split production stock verification into owner-approved chunks.

## Goal 6 - Operational Smoke And Documentation Ingestion
Status: done
- [x] Run `npm run build` and available tests.
- [x] Verify health endpoint after owner approval for external checks.
- [x] Trigger DocsRAG ingestion when credentials and tooling are available.
- [x] Verify retrieval returns current Suppliers IPS docs.

## Goal 7 - Warehouse Reconciliation Client
Status: done
- [x] Add validation-first normalized supplier stock candidate requirements.
- [x] Add approved Warehouse supplier reconciliation client using runtime service token.
- [x] Preserve default import execution as non-mutating.
- [x] Validate idempotency-derived external references and no credential leakage.

## Goal 8 - Current-Head Cross-Service Stock Traceability Completion
Status: active

Parallelization: split into independent readiness, source-verification, runtime-execution, and status-consolidation sessions. Runtime execution must wait for owner approval and readiness evidence.

Agent-ready chunks:
- [x] Readiness regeneration: regenerated current-head runtime handoff, readiness manifest, and deployment evidence templates from clean Warehouse, Catalog, and Suppliers heads. Evidence: Warehouse 7639539c1eb3a1db6761e7fc43e5266c69fd94ed, Catalog 4f3be18ecae4642360d82b53d5b8acc35fd960aa, Suppliers b702c192c3ea00a9001493e7fed0b8543b78c290, generated /tmp artifact paths and hashes, and passed preflight output.
- [x] Source preflight verification: reran non-mutating cross-service preflight, strict documentation audit, and whitespace checks. Evidence: cross-service preflight passed, strict documentation audit passed 100/100, and git diff --check passed against the current clean heads.
- [ ] Runtime deployment and guarded smoke: deploy current heads and run guarded stock traceability evidence flow. Cannot start yet. Blockers: owner deployment/runtime approval, readiness artifacts from the readiness chunk, runtime credentials, clean worktrees, and protected production mutation boundary. Evidence: deployment evidence JSON, runtime report, runtime manifest, completion verifier output.
- [x] Status consolidation: updated orchestrator status, implementation state, and continuation state after readiness/source chunks completed. Runtime completion status remains blocked until owner-approved deployment and guarded smoke evidence exist.

## Goal 9 - Supplier-Specific API Integration
Status: blocked

Parallelization: only contract discovery and planning can run now. Adapter coding must wait for real supplier details.

Blockers:
- Owner has not supplied supplier identity.
- Owner has not supplied private endpoint, authentication shape, credential reference plan, payload schema, rate limits, pagination, or sanitized sample response.
- Production database currently has no supplier rows or credential references to infer a real contract.

Agent-ready chunks:
- [x] Contract intake checklist: prepared exact owner questions and execution-plan gate in `docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md` and `docs/intent-preservation/execution-plans/EP-TASK-002-CONTRACT-INTAKE.md`. Evidence: documentation validation and no invented supplier details.
- [x] Derived REST/JSON contract boundary: documented the generic `rest` adapter details that can be safely derived from repo source in `docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md`. Evidence: docs validation, source contract checks, and no real supplier facts fabricated.
- [ ] Adapter implementation: blocked until contract intake is complete and reviewed. Evidence when unblocked: synthetic contract tests, credential-safety review, idempotency evidence, Catalog/Warehouse boundary evidence.
