# TASK-002 Derived REST JSON Contract Details

```yaml
id: TASK-002-DERIVED-REST-JSON-DETAILS
status: generic-rest-approved-data-gated
owner: supplier-service-owner
created: 2026-06-21
last_updated: 2026-06-21
completeness_level: partial-derived-owner-input-required
upstream:
  - docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md
  - docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md
  - docs/supplier-contracts/TASK-002_GENERIC_REST_ONBOARDING_APPROVAL.md
  - src/imports/adapters/README.md
  - src/imports/adapters/production-rest-json-supplier-adapter.ts
  - src/imports/adapters/supplier-import-adapter.ts
  - reports/validation/production-rest-json-adapter-check.js
  - reports/validation/synthetic-production-rest-json-adapter-check.js
```

## Purpose

Record the TASK-002 supplier contract details that can be safely derived from the current repository and the generic production REST/JSON adapter. The owner selected this generic `rest` onboarding path on 2026-06-21. This document does not add a real supplier, endpoint, credential, production payload, Catalog write, Warehouse mutation, deployment, or adapter implementation.

## Intent Preservation Chain

- Vision: Suppliers remains the validation-first intake service for supplier product and stock feeds.
- Goal Impact: TASK-002 has owner approval to proceed through the existing generic REST/JSON adapter only when a real supplier contract matches this document and all remaining owner-supplied facts are reviewed.
- System: Supplier metadata, import jobs, category mappings, payload validation, Catalog ownership boundaries, Warehouse stock authority, and idempotency remain separated.
- Feature: Generic production REST/JSON supplier onboarding using adapter key `rest`. Supplier-code-specific adapter work is out of scope unless later facts prove the supplier does not match this contract.
- Task: Separate repo-derived contract details from missing external supplier facts before any coding or runtime onboarding.
- Execution Plan: Use this document with `docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md` and `docs/intent-preservation/execution-plans/EP-TASK-002-CONTRACT-INTAKE.md`.
- Coding Prompt: Still blocked until owner-supplied facts complete the contract and the pre-coding gate passes.
- Code: No source change is authorized by this document.
- Validation: Documentation audit, whitespace check, source contract checks, and secret-pattern review.

## Safely Derived Contract Details

| Area | Current repo-derived detail | Source | TASK-002 decision impact |
| --- | --- | --- | --- |
| Adapter key | The generic production adapter is registered as `rest`. | `PRODUCTION_REST_JSON_V1.md`, `production-rest-json-supplier-adapter.ts` | A supplier that exactly matches this contract does not need a new adapter key. |
| Supplier metadata | Supplier record must provide `apiType=rest` and an `apiUrl`; `apiCredentials` may contain reference names only. | `PRODUCTION_REST_JSON_V1.md`, `SupplierAdapterRunSupplier` | Real supplier identity, code, active row, endpoint config, and secret refs remain owner-supplied. |
| Transport | Adapter performs HTTP GET, requires HTTPS by default, disables redirects, requests JSON, and uses `SUPPLIER_REST_JSON_TIMEOUT_MS` or 15000 ms. HTTP is allowed only when `SUPPLIER_REST_JSON_ALLOW_HTTP=true`. | `production-rest-json-supplier-adapter.ts` | Suppliers needing POST, files, redirects, non-JSON, custom TLS, OAuth flows, or pagination require contract extension or a supplier-specific adapter. |
| Authentication references | `apiKeyRef` resolves to `X-API-Key`; `tokenRef` resolves to bearer auth; `usernameRef` plus `passwordRef` resolves to basic auth. Values are read from runtime env and must not be committed. | `PRODUCTION_REST_JSON_V1.md`, `production-rest-json-supplier-adapter.ts` | Reference key names and secret provisioning are still missing external facts. |
| Top-level payload shape | Accepted response is either a JSON array or an object with an `items` array. | `PRODUCTION_REST_JSON_V1.md`, `extractItems` | Suppliers returning a different item path need a supplier-specific adapter or approved contract change. |
| Required item fields | Each item must include non-empty string `supplierSku` and non-negative integer `stockQuantity`. | `PRODUCTION_REST_JSON_V1.md`, `normalizeItem` | This is enough for normalized stock candidate creation, but not enough for Catalog writes or Warehouse mutation approval by itself. |
| Optional item fields | `sourceRecordId`, `productId`, `warehouseId`, `supplierId`, and `observedAt` are accepted when non-empty strings. `sourceRecordId` defaults to `supplierSku`; `supplierId` defaults to the import supplier ID. | `PRODUCTION_REST_JSON_V1.md`, `normalizeItem` | Product, warehouse, and supplier ownership semantics still need owner review for a real supplier. |
| Replay key | Replay key is a SHA-256 digest of `idempotencyKey:sourceRecordId`, truncated to 32 hex characters. | `buildReplayKey` | Supplier-specific source record stability must still be confirmed. |
| Source fingerprint | Adapter uses caller-provided `sourceFingerprint` or derives `rest-json-v1:<sha256>` from supplier code and sorted source record IDs. | `buildSourceFingerprint` | Delta sync, deleted records, and replay behavior remain owner-supplied policy. |
| Downstream gates | Adapter output must pass adapter result validation and normalized supplier payload validation before downstream work. Catalog and Warehouse mutation remain separately gated. | `supplier-import-adapter.ts`, `import-validation.ts` | Generic REST onboarding does not remove category, Catalog, Warehouse, or mutation approval gates. |
| Existing validation | Source checks cover adapter key, contract version, runtime credential reference resolution, deterministic replay/fingerprints, malformed payload blocking, redirect blocking, and supplier ID stamping with synthetic data. | `production-rest-json-adapter-check.js`, `synthetic-production-rest-json-adapter-check.js` | These checks prove the generic contract only; they do not validate any private supplier endpoint. |

## Missing External Facts

The following facts cannot be safely derived from the repo and must remain `[MISSING: ...]` until supplied by the owner in non-secret form:

- [MISSING: real supplier display name, stable supplier code, business owner, technical owner, and escalation path]
- [MISSING: active supplier row or approved onboarding path for creating one]
- [MISSING: private endpoint location or runtime endpoint reference plan outside committed docs]
- [MISSING: authentication shape decision and runtime credential reference key names]
- [MISSING: secret creation, rotation, and deployment owner]
- [MISSING: confirmation that the supplier response is a JSON array or `{ "items": [...] }` using the exact generic field names]
- [MISSING: sanitized valid, empty, malformed, paginated, and supplier-error examples]
- [MISSING: product identity mapping, Catalog category mapping prerequisites, and Catalog write constraints]
- [MISSING: warehouse/location mapping, dropship versus supplier-managed semantics, and Warehouse mutation approval boundary]
- [MISSING: pagination, delta-sync, timeout, retry, backoff, concurrency, and rate-limit policy]
- [MISSING: source record stability, source fingerprint policy, deletion/discontinuation semantics, and replay expectations]
- [APPROVED: owner selected generic `rest` onboarding path on 2026-06-21]
- [MISSING: owner validation evidence and approval to execute a runtime onboarding run after all data is supplied]

## Current Execution Decision

TASK-002 supplier-specific adapter coding is not the selected path. The owner selected generic REST onboarding on 2026-06-21, but runtime onboarding remains blocked by missing supplier facts.

1. Generic REST onboarding: selected. Use adapter key `rest` when the real supplier exactly matches the derived contract above and owner supplies only non-secret metadata, runtime reference names, and synthetic or masked fixtures.
2. Supplier-specific adapter: not selected. Create a new plan and coding prompt only if later supplier facts require a different transport, authentication flow, payload path, pagination model, field mapping, error model, or side-effect policy.

No real private supplier credentials, endpoints, raw production payloads, real SKUs, real product IDs, production imports, Catalog writes, Warehouse stock mutations, or cleanup operations are permitted from this derived document alone.
