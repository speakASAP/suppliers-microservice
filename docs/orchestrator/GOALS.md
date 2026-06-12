# Suppliers Goal Backlog

Status values: `pending`, `active`, `done`, `blocked`.

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
Status: pending
- [ ] Audit mapping create/update semantics.
- [ ] Define missing, stale, or ambiguous mapping behavior before import.
- [ ] Add validation for mapping identifiers and duplicate mapping updates.
- [ ] Record Catalog ownership boundary and consumer compatibility risks.

## Goal 5 - Warehouse Stock Update Boundary
Status: pending
- [ ] Identify current and intended Warehouse update paths.
- [ ] Define stock payload validation, actor, reason, and idempotency evidence.
- [ ] Add focused tests or contract notes for stock update failure behavior.
- [ ] Split production stock verification into owner-approved chunks.

## Goal 6 - Operational Smoke And Documentation Ingestion
Status: pending
- [ ] Run `npm run build` and available tests.
- [ ] Verify health endpoint after owner approval for external checks.
- [ ] Trigger DocsRAG ingestion when credentials and tooling are available.
- [ ] Verify retrieval returns current Suppliers IPS docs.
