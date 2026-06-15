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
- [ ] Readiness regeneration: regenerate current-head runtime handoff, readiness manifest, and deployment evidence templates from clean Warehouse, Catalog, and Suppliers heads. Can start now. Blockers: dirty worktree in any service or missing sibling repository. Evidence: clean SHAs, generated artifact paths, hash checks, preflight output.
- [ ] Source preflight verification: rerun non-mutating cross-service preflight, strict documentation audit, and whitespace checks. Can start now. Blockers: source drift, stale sibling service heads, missing validation scripts. Evidence: command output and current SHAs.
- [ ] Runtime deployment and guarded smoke: deploy current heads and run guarded stock traceability evidence flow. Cannot start yet. Blockers: owner deployment/runtime approval, readiness artifacts from the readiness chunk, runtime credentials, clean worktrees, and protected production mutation boundary. Evidence: deployment evidence JSON, runtime report, runtime manifest, completion verifier output.
- [ ] Status consolidation: update orchestrator status, implementation state, validation report links, and next-wave blockers after readiness/source/runtime chunks complete. Can start after readiness/source evidence exists. Blockers: missing evidence from prior chunks. Evidence: updated docs with no unresolved execution-critical markers.

## Goal 9 - Supplier-Specific API Integration
Status: blocked

Parallelization: only contract discovery and planning can run now. Adapter coding must wait for real supplier details.

Blockers:
- Owner has not supplied supplier identity.
- Owner has not supplied private endpoint, authentication shape, credential reference plan, payload schema, rate limits, pagination, or sanitized sample response.
- Production database currently has no supplier rows or credential references to infer a real contract.

Agent-ready chunks:
- [x] Contract intake checklist: prepared exact owner questions and execution-plan gate in `docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md` and `docs/intent-preservation/execution-plans/EP-TASK-002-CONTRACT-INTAKE.md`. Evidence: documentation validation and no invented supplier details.
- [ ] Adapter implementation: blocked until contract intake is complete and reviewed. Evidence when unblocked: synthetic contract tests, credential-safety review, idempotency evidence, Catalog/Warehouse boundary evidence.
