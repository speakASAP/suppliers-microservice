# Goal 4 - Category Mapping Completeness And Catalog Boundary

Status: done. Owner: suppliers-owner. Created: 2026-06-13. Completed: 2026-06-13.

## Intent

Supplier category mappings must be explicit before supplier category data is treated as Catalog-ready. Suppliers may store a supplier-category to Catalog-category reference, but Catalog remains the owner of category identity and taxonomy.

## Precondition Decision

The import-job database migration from Goal 3 should be prepared before production deployment because production disables TypeORM synchronization. It is not a blocker for Goal 4 source work, but it is required before deploying the idempotency and payload-validation columns introduced by Goal 3.

## Selected Slice

Implement the nearest safe service-local slice: validate category mapping request identifiers, make duplicate mapping updates deterministic, expose a completeness check for supplied supplier category IDs, and document missing/stale/ambiguous mapping behavior without querying production supplier payloads.

## Scope

- Add a source SQL migration artifact for Goal 3 import-job idempotency and validation columns.
- Validate mapping create/update request identifiers with DTOs.
- Require Catalog category IDs to be explicit UUID references.
- Preserve upsert semantics for duplicate supplier-category mappings while avoiding duplicate rows.
- Add a deterministic mapping completeness check for caller-supplied supplier category IDs.
- Record Catalog ownership boundary and consumer compatibility risks.

## Non-Goals

No production migration execution, deployment, Catalog category lookup, Catalog taxonomy change, automatic mapping approval, supplier-specific adapter, real supplier payload query, credential access, downstream Catalog product write, or Warehouse stock mutation.

## File Scope

src/database/migrations/202606130001-import-job-idempotency-validation.sql, src/mappings/dto/set-category-mapping.dto.ts, src/mappings/dto/validate-category-mappings.dto.ts, src/mappings/category-mapping.entity.ts, src/mappings/mappings.controller.ts, src/mappings/mappings.service.ts, docs/10_features/FEAT-002-category-mapping.md, docs/12_validation/VAL-TASK-003-review-category-mapping-completeness.md, docs/16_operations/INTEGRATIONS.md, docs/21_execution_plans/EP-TASK-003-review-category-mapping-completeness.md, docs/orchestrator/GOALS.md, docs/orchestrator/PLAN.md, docs/orchestrator/STATUS.md, docs/IMPLEMENTATION_STATE.md, TASKS.md, STATE.json.

## Invariant Review

SUPPLIERS-INV-001 and SUPPLIERS-INV-006 are strengthened by explicit mapping ownership and deterministic completeness checks. SUPPLIERS-INV-002 is preserved because Catalog category IDs are referenced, not redefined. SUPPLIERS-INV-003 and SUPPLIERS-INV-008 are preserved because no secrets, production payloads, production migration execution, production imports, deployment, or downstream writes are performed. SUPPLIERS-INV-010 is satisfied by updating status evidence.

## Sensitive-Data Classification

Classification: sensitive by domain; synthetic only for validation. Supplier category IDs and names can be commercially sensitive, so validation evidence must avoid production category names and raw supplier payloads.

## Mapping Behavior

Missing mappings block safe Catalog import for affected supplier category IDs. Stale mappings must be resolved by a reviewed mapping update, not by changing Catalog taxonomy from Suppliers. Ambiguous mapping inputs are rejected by request validation and duplicate category IDs in completeness checks are rejected by DTO validation.

## Catalog Boundary

Suppliers stores only the Catalog category identifier selected by an operator or upstream workflow. Suppliers does not create Catalog categories, rename Catalog categories, infer final Catalog taxonomy, or treat supplier category labels as Catalog category truth.

## Consumer Compatibility

The existing `POST /api/mappings` endpoint keeps its response envelope and upsert behavior, but now rejects invalid body fields and requires `catalogCategoryId` to be a UUID. Consumers sending non-UUID Catalog category identifiers must be aligned with Catalog before deployment.

## Validation Commands

- python3 scripts/pre_coding_gate.py --root .
- npm run build
- node -e validation of dist/mappings/mappings.service.js with a mocked repository
- python3 scripts/deployment_readiness_gate.py --root .

## Decision

Proceed. The import-job migration is prepared first as a source artifact and remains unapplied pending owner approval.

## Evidence

- python3 scripts/pre_coding_gate.py --root . passed before source edits.
- npm run build passed after source edits.
- Synthetic compiled-service mapping check passed with one deterministic upsert row and one reported missing category.
- python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues passed.
- python3 scripts/deployment_readiness_gate.py --root . passed.
- Owner approved production migration and deployment after implementation.
- Live database migration applied and created/validated Suppliers-owned tables.
- Production deployment completed; in-pod and external health checks returned healthy.

## Next Action

Proceed to Goal 5 - Warehouse Stock Update Boundary.
