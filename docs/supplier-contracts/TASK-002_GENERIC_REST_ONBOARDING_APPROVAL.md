# TASK-002 Generic REST Onboarding Approval

```yaml
id: TASK-002-GENERIC-REST-ONBOARDING-APPROVAL
status: approved-data-gated
owner: supplier-service-owner
created: 2026-06-21
last_updated: 2026-06-21
completeness_level: owner-input-required
upstream:
  - docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md
  - docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md
  - docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md
  - docs/21_execution_plans/EP-TASK-002-CONTRACT-INTAKE.md
```

## Purpose

Record the owner decision that the next TASK-002 lane is generic REST onboarding through adapter key `rest`. This approval selects the onboarding path only. It does not supply a real supplier row, private endpoint, credential reference names, payload samples, mapping facts, deployment permission, production import approval, or Warehouse mutation approval.

## Intent Preservation Chain

- Vision: Suppliers remains the validation-first intake service for supplier product and stock feeds.
- Goal Impact: TASK-002 now has an owner-selected generic REST onboarding path, but real onboarding remains data-gated until the supplier contract facts are supplied and reviewed.
- System: Supplier metadata, import jobs, category mappings, payload validation, Catalog ownership boundaries, Warehouse stock authority, and idempotency remain separated.
- Feature: Generic production REST/JSON supplier onboarding using adapter key `rest` and `apiType=rest`.
- Task: Prepare the data-gated runtime onboarding lane without adding supplier-specific adapter code or committing secrets.
- Execution Plan: Continue under `EP-TASK-002-CONTRACT-INTAKE`; generate a runtime onboarding runbook only after the missing facts are supplied.
- Coding Prompt: No source coding prompt is required for the generic adapter path unless the owner-supplied contract deviates from `PRODUCTION_REST_JSON_V1`.
- Code: No source behavior change is authorized by this approval.
- Validation: Current repo validation proves the generic adapter contract only; a real supplier runtime check requires separate owner approval after data is supplied.

## Approved Decision

The owner approved generic REST onboarding on 2026-06-21. The selected path is:

- adapter key: `rest`
- supplier row `apiType`: `rest`
- transport: HTTPS JSON GET by default
- payload shape: JSON array or `{ "items": [...] }`
- required item fields: `supplierSku`, `stockQuantity`
- optional item fields: `sourceRecordId`, `productId`, `warehouseId`, `supplierId`, `observedAt`
- credentials: runtime secret reference names only through `apiCredentials`

## Still Missing Before Runtime Onboarding

- [MISSING: real supplier display name]
- [MISSING: stable supplier code]
- [MISSING: business owner, technical owner, and escalation contact]
- [MISSING: active supplier row creation/update approval with exact non-secret metadata]
- [MISSING: private endpoint value or approved runtime endpoint reference plan]
- [MISSING: authentication shape and runtime credential reference key names]
- [MISSING: secret creation, rotation, and deployment owner]
- [MISSING: confirmation that the real supplier response exactly matches `PRODUCTION_REST_JSON_V1`]
- [MISSING: sanitized valid, malformed, empty, paginated, and supplier-error examples]
- [MISSING: product identity mapping and Catalog category mapping prerequisites]
- [MISSING: warehouse/location mapping and Warehouse mutation boundary]
- [MISSING: pagination, delta-sync, timeout, retry, backoff, concurrency, and rate-limit policy]
- [MISSING: source record stability, source fingerprint policy, deletion/discontinuation semantics, and replay expectations]
- [MISSING: owner approval for any runtime import, deployment, or Warehouse mutation]

## Runtime Onboarding Gate

Before creating or updating any runtime supplier row, the operator must have:

1. A completed non-secret supplier contract document under `docs/supplier-contracts/`.
2. Exact supplier row metadata: `name`, `code`, `apiType=rest`, `apiUrl`, optional `apiCredentials` reference names, optional `syncSchedule`, and `isActive` intent.
3. Confirmation that credential values exist only in runtime secret storage and are never printed or committed.
4. Synthetic or masked payload fixtures proving the accepted shape and failure modes.
5. Category, product, and Warehouse mapping facts reviewed by the owner.
6. Explicit owner approval for any production import or Warehouse mutation.
7. Fresh validation evidence from a clean worktree.

## Parallel Execution

- Contract completion: dependency-gated. Owner must provide missing non-secret facts. Allowed files: docs under `docs/supplier-contracts/`. Forbidden: source code, secrets, production payloads, runtime imports.
- Runtime config preparation: blocked. Requires exact credential reference names and secret owner. Forbidden: decoded secret values in docs or logs.
- Supplier row onboarding: blocked. Requires exact row metadata and explicit approval for DB mutation.
- Mapping preparation: blocked. Requires owner-confirmed supplier category/product/warehouse facts.
- Runtime smoke/import: blocked. Requires supplier row, runtime secret refs, clean worktree, deployment evidence if needed, and explicit runtime approval.
- Integration owner: original coordinator thread.
- Validation owner: runtime/onboarding operator after data is supplied.
- Merge order: contract facts first, then runtime config/row plan, then mapping plan, then approved runtime smoke/import.

## Boundary Decision

This approval does not authorize supplier-specific adapter implementation, deployment, production import, Catalog write, Warehouse stock mutation, cleanup mutation, secret inspection/printing, raw production payload capture, or committing private URLs.
