# Suppliers Orchestrator Status

## 2026-06-12 - Intent Preservation System

Current focus: add the company Intent Preservation System to `suppliers-microservice`. Runtime code changes: none. Deployment: not required.

Source context reviewed: `AGENTS.md`, `README.md`, `BUSINESS.md`, `SYSTEM.md`, `TASKS.md`, `STATE.json`, `CLAUDE.md`, package metadata, app module, supplier controller/service/entity, import controller/service, mapping controller/service, and remote git status. Company IPS examples reviewed from Leads, Warehouse, AI, Auth, Catalog, and Backups services.

DocsRAG: attempted the documented in-pod retrieval command, but the `suppliers-microservice` container does not have `curl` in `PATH`. This documentation-only task used repo-local source-of-truth docs and recorded the limitation.

Implementation evidence: added `docs/orchestrator/`, `docs/intent-preservation/`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, `implementation-goals/`, updated `AGENTS.md`, appended `TASKS.md`, and updated `STATE.json`.

Validation evidence: documentation presence, unresolved-marker, secret-pattern, JSON, and git-status checks run on `alfares`. Runtime validation and deployment are not required because no source, schema, secret, or deployment files changed.

Next unfinished chunk: Goal 2 - Supplier Contract And Credential Safety.

## 2026-06-12 - Add curl to production image

Change: updated Dockerfile production stage to install curl and ca-certificates with apt-get.

Validation: docker build --target production -t suppliers-microservice:curl-check . passed on alfares. docker run --rm --entrypoint sh suppliers-microservice:curl-check -lc "command -v curl && curl --version | sed -n 1p" returned /usr/bin/curl and curl 7.88.1.

Deployment: not run in this task. The live Kubernetes pod will have curl after the next suppliers-microservice image build and deployment.


## 2026-06-12 - Goal 2 Supplier Contract And Credential Safety

Change: added supplier create/update DTO validation, constrained `apiType` to `rest`, `xml`, `csv`, or `ftp`, validated API URLs and schedule strings, and changed the application contract for `apiCredentials` to runtime secret-reference metadata. Supplier list, read, create, and update responses now redact `apiCredentials` and return only `hasCredentials` while preserving the `{ success, data }` response envelope.

Validation evidence: `python3 scripts/pre_coding_gate.py --root .` passed before source edits. `npm run build` passed after source edits. Sensitive-data review found no real credentials, raw supplier payloads, or production samples added.

Next unfinished chunk: Goal 3 - Import Validation And Idempotency. Operational follow-up remains: deploy the production image so the live pod receives `curl`.


## 2026-06-12 - Goal 3 Import Validation And Idempotency

Change: added import run DTO validation for manual and scheduled trigger metadata, supplier active-state validation before job creation, import job idempotency metadata, duplicate supplier/idempotency-key job reuse, and sanitized payload-validation outcome fields. Added a generic normalized supplier payload validator that future adapter code must pass before Catalog or Warehouse writes.

Boundary decision: no supplier-specific TASK-002 adapter, Catalog product write, Warehouse stock mutation, production import, or deployment was implemented. Current import execution still performs no downstream writes; it records validation state and completes zero-item synthetic work only.

Validation evidence: python3 scripts/pre_coding_gate.py --root . passed before source edits. npm run build passed. Synthetic payload validator check passed with one valid item and two invalid synthetic items. Synthetic duplicate-run check passed with one saved job and replay metadata showing created false and shouldRun false. python3 scripts/deployment_readiness_gate.py --root . passed.

Next unfinished chunk: Goal 4 - Category Mapping Completeness And Catalog Boundary. Operational follow-ups remain: deploy the production image so the live pod receives curl, and add an owner-approved database migration before deploying the new import job idempotency columns to production.

## 2026-06-13 - Goal 4 Category Mapping Completeness And Catalog Boundary

Precondition decision: prepare the Goal 3 import-job database migration before production deployment because production disables TypeORM synchronization. The migration was added as a source artifact only and was not applied to production.

Change: added request DTO validation for mapping upserts and mapping completeness checks, made `catalogCategoryId` required on new mapping writes, preserved deterministic upsert behavior for duplicate supplier-category mappings, and added a service/API completeness check for caller-supplied supplier category IDs. Documented that missing mappings block safe Catalog import, stale mappings require reviewed updates, and Suppliers references Catalog category IDs without owning Catalog taxonomy.

Boundary decision: no production data query, production migration execution, deployment, Catalog category mutation, automatic mapping approval, supplier-specific adapter, Catalog product write, or Warehouse stock mutation was performed.

Validation evidence: python3 scripts/pre_coding_gate.py --root . passed before source edits. npm run build passed. Synthetic compiled-service mapping check passed with one deterministic upsert row and one reported missing category. python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues passed. python3 scripts/deployment_readiness_gate.py --root . passed.

Next unfinished chunk: Goal 5 - Warehouse Stock Update Boundary. Operational follow-ups remain: apply the owner-approved import-job migration and deploy the production image only after owner approval.

## 2026-06-13 - Production Migration And Deployment

Approval: owner approved applying the prepared migration and proceeding with deployment.

Migration: applied `src/database/migrations/202606130001-import-job-idempotency-validation.sql` to the live `suppliers` database through the `db-server-postgres` pod. Production had no public Suppliers tables before migration, so the migration was expanded to create the service-owned `suppliers`, `category_mappings`, and `import_jobs` tables idempotently before adding the Goal 3 import-job idempotency and payload-validation columns.

Deployment: committed source as `765e30e` and ran `./scripts/deploy.sh`. The script built and pushed `localhost:5000/suppliers-microservice:765e30e` and `:latest`, applied Kubernetes manifests, and reported rollout success. Because the deployment spec still referenced `:latest`, an explicit `kubectl rollout restart deployment/suppliers-microservice -n statex-apps` was required to pull the new image.

Verification: new pod `suppliers-microservice-c88759bd5-rv2x8` is ready, in-pod `/usr/bin/curl` exists, in-pod `curl http://127.0.0.1:3202/api/health` returned healthy, and external `https://suppliers.alfares.cz/api/health` returned healthy.

Known deviation: npm install during Docker build reported existing npm audit findings. They were not remediated in this goal.


## 2026-06-13 - Goal 5 Warehouse Stock Update Boundary

Change: added service-local Warehouse stock-boundary validation and import-job evidence fields for validation status, sanitized validation errors, actor, reason, idempotency key, approval state, and mutation-attempt marker. Added an unapplied migration artifact for the new import-job evidence columns.

Boundary decision: current Suppliers import code has no Warehouse mutation client and this goal did not add one. Production stock mutation, production stock verification, migration execution, and deployment remain owner-approval gated.

Validation evidence: python3 scripts/pre_coding_gate.py --root . passed before source edits. npm run build passed. Synthetic compiled-validator check passed for malformed stock candidates, unapproved mutation attempts, and a valid synthetic candidate. Strict documentation audit passed. Deployment-readiness gate passed.

Next unfinished chunk: Goal 6 - Operational Smoke And Documentation Ingestion. Operational follow-up remains: apply the Goal 5 migration and deploy only after owner approval.
