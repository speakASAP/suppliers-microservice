# EP-TASK-002: Add New Supplier API Integration

```yaml
id: EP-TASK-002
status: draft
source_task: ../11_tasks/TASK-002-add-new-supplier-api-integration.md
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-13
completeness_level: complete
vision: ../01_vision/VISION.md
constitution: ../00_constitution/CONSTITUTION.md
feature: ../10_features/FEAT-001-supplier-api-integration.md
goal_impact: ../22_goal_impact/GOAL-IMPACT-TASK-002.md
```

## Metadata

Task: `TASK-002`. Lifecycle state: draft and blocked for adapter implementation. Must be reviewed before coding. Current allowed work is contract intake and owner-question preparation only.

## Upstream Traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../22_goal_impact/GOAL-IMPACT-TASK-002.md`

## Goal Impact

Adds supplier-specific ingestion capability while preserving validation and idempotency constraints.

## Project Invariants

- Keep credentials out of source/docs/prompts/logs.
- Validate supplier data before catalog writes.
- Preserve idempotent import re-runs.
- Respect category mapping gaps.

## Sensitive-Data Handling

Use environment-managed credentials only. Tests and docs must use synthetic or masked values. Errors must not include tokens, passwords, API keys, or raw sensitive payloads.

## Contract Validation Plan

Document supplier source contract, transformed internal representation, and downstream Catalog/Warehouse payload expectations before implementation. Add validation evidence to a new validation report.

## Current Blocked State

Adapter implementation remains blocked because the real supplier contract has not been supplied or approved. The existing `rest` adapter and `docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md` prove a generic Suppliers-owned REST/JSON path, but they do not identify a real supplier-specific source. Do not infer a supplier from production, logs, examples, names, private URLs, or credentials.

Required blockers to clear before coding:

- [MISSING: real supplier identity and stable supplier code]
- [MISSING: private endpoint or file-source location stored outside committed docs]
- [MISSING: authentication shape]
- [MISSING: runtime credential reference plan]
- [MISSING: payload schema]
- [MISSING: rate limits]
- [MISSING: pagination or incremental-fetch behavior]
- [MISSING: sanitized sample response]
- [MISSING: owner approval to convert this plan into a coding prompt]

## Supplier-Specific Contract Intake Checklist

The owner must provide the following inputs before adapter implementation can start. Record private values only in runtime configuration or an approved secret manager; committed docs may contain reference names, masked values, and synthetic examples only.

| Area | Required owner input | Acceptance gate |
| --- | --- | --- |
| Supplier identity | Legal/display name, internal supplier code, adapter key proposal, source type, business owner, operational contact. | Supplier code is stable, non-secret, and does not collide with existing adapter keys or supplier codes. |
| Endpoint | Source protocol, HTTPS base URL or file-source descriptor, resource path, method, query parameters, required headers, timeout, redirect policy, environment split. | Private endpoints are not committed; docs contain only masked descriptors or runtime config keys. |
| Auth shape | None/API key/bearer/basic/OAuth2/HMAC/mTLS/other, token refresh behavior, required header names, expiry semantics. | No decoded secrets, tokens, passwords, usernames, client secrets, or authorization headers appear in docs, tests, prompts, logs, or fixtures. |
| Credential references | Runtime secret reference names, owner of secret provisioning, rotation expectations, missing-secret behavior. | Implementation can resolve only references such as `apiKeyRef` or `tokenRef`; raw credential storage is forbidden. |
| Payload schema | Required and optional source fields, data types, nullability, enum values, units, date/time formats, nested object rules, versioning. | Schema is documented using synthetic field examples and is sufficient to validate before any downstream write. |
| Pagination and incremental fetch | Page/cursor/link/header behavior, batch size, stop conditions, date filters, full vs delta semantics. | Adapter can prove deterministic termination and retry behavior without duplicate downstream effects. |
| Rate limits and retry policy | Request quotas, burst limits, backoff rules, retryable statuses, timeout budget, circuit-break expectations. | Plan defines safe retry boundaries and sanitized failure reporting. |
| Error model | HTTP statuses, supplier error body shape, auth failures, validation failures, partial success, malformed payload behavior. | Logs and import errors expose only sanitized categories and stable codes, not raw payloads or secrets. |
| Idempotency keys | Source record ID, supplier SKU stability, source fingerprint inputs, replay key rules, duplicate record handling. | Re-running the same import can be validated as deterministic before Catalog or Warehouse effects. |
| Category mapping | Source category identifiers, hierarchy semantics, fallback rules, unmapped-category blocking behavior. | Missing, stale, or ambiguous mappings block Catalog writes and are visible in validation evidence. |
| Catalog boundary | Which normalized product fields may be proposed to Catalog, Catalog-owned fields, validation failures, write approval expectations. | Suppliers does not become product truth owner and does not bypass validation-before-Catalog-write. |
| Warehouse boundary | Which stock fields may be proposed to Warehouse, warehouse ID mapping, observed-at semantics, mutation approval mode. | Suppliers does not become stock truth owner and Warehouse mutation remains owner-approval gated. |
| Sanitized examples | Synthetic request/response examples, malformed examples, empty-page examples, error examples. | Examples contain no private URLs, real SKUs, real product IDs, raw production payloads, customer data, or secrets. |
| Validation commands | Build command, adapter contract check, malformed payload check, idempotency/replay check, sensitive-data scan, documentation audit, deployment-readiness gate. | Commands are named before coding and later recorded with output evidence in validation report. |
| Blockers and approvals | Remaining unknowns, owner approval artifact, implementation scope, forbidden actions, rollback scope. | Coding prompt cannot be created until all execution-critical blockers are resolved or explicitly accepted by owner. |

## Required Owner Questions

1. What real supplier identity and stable internal supplier code should TASK-002 target?
2. What is the source endpoint or file-source descriptor, and where will the private endpoint be stored outside committed docs?
3. Which authentication scheme is required, and which runtime credential reference names should the service resolve?
4. What exact payload schema should be validated for products, stock, categories, pagination metadata, and error responses?
5. What are the supplier rate limits, timeout expectations, retryable errors, and backoff rules?
6. How should pagination, incremental fetches, empty pages, and partial failures terminate deterministically?
7. Which source fields define stable source record IDs, supplier SKUs, source fingerprints, and replay keys?
8. Which source category identifiers must map to Catalog categories, and what should happen for missing, stale, or ambiguous mappings?
9. Which normalized product fields may Suppliers propose to Catalog, and which fields remain Catalog-owned?
10. Which stock fields may Suppliers propose to Warehouse, and what owner approval is required before any Warehouse mutation?
11. Can the owner provide sanitized synthetic request/response/error examples that preserve shape without raw production data?
12. Does the owner approve converting this draft plan into a coding prompt after the checklist is complete?

## Replay/Determinism Plan

Define how the integration identifies repeated records, avoids duplicate writes, and records job counters deterministically enough for safe retries.

## Scope

One supplier-specific integration after supplier identity and contract are provided by the owner. This planning slice produces the intake checklist only; it does not implement, register, or call a supplier adapter.

## Non-Goals

Broad adapter framework rewrite, catalog schema ownership changes, warehouse ownership changes, or secret storage changes.

## Files to Inspect

- `src/imports/imports.service.ts`
- `src/imports/import-job.entity.ts`
- `src/suppliers/supplier.entity.ts`
- `src/mappings/category-mapping.entity.ts`
- `src/app.module.ts`

## Files to Create

Supplier-specific adapter files and tests as approved during owner review.

## Files to Modify

Import service/module files and configuration files explicitly approved during owner review.

## Files That Must Not Be Modified

- `.env`
- `.env.backup*`
- `docs/00_constitution/`
- `docs/01_vision/`
- Kubernetes secret manifests containing real values

## Implementation Steps

Contract-intake phase, currently allowed:

1. Confirm all required owner inputs in the supplier-specific contract intake checklist.
2. Document validation rules and synthetic-only request, response, empty-page, malformed-payload, and error examples.
3. Record unresolved blockers in the Current Blocked State and Required Owner Questions sections instead of making assumptions.
4. Obtain owner approval before creating a coding prompt.

Adapter phase, currently blocked:

1. Add adapter and parser only after owner approval.
2. Add transformation validation.
3. Integrate with import job status and counters.
4. Add tests or contract checks.
5. Update validation report and audit evidence.

## Test Plan

Planning/discovery validation for this intake slice:

- `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues`
- `git diff --check`

Future adapter validation after owner approval:

- `npm run build`
- Supplier-specific adapter contract check using synthetic payloads only
- Malformed payload and sanitized error checks
- Transformation validation before Catalog/Warehouse effects
- Sensitive-data scan for credentials, private endpoints, raw production payloads, real SKUs, and authorization headers
- Idempotency/replay checks for duplicate import attempts

## Validation Plan

Create `../12_validation/VAL-TASK-002-add-new-supplier-api-integration.md` with command evidence and review outcomes.

## Gate Commands

Planning/discovery gates for this checklist update:

```bash
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
git diff --check
```

Pre-coding and implementation gates after owner approval:

```bash
python3 scripts/pre_coding_gate.py --root .
npm run build
python3 scripts/deployment_readiness_gate.py --root .
```

## Documentation Updates

Update supplier-specific context package, prompt, validation report, and integration docs.

## Rollback Plan

Revert adapter, registration, and tests for the supplier integration. Preserve validation report with deviation notes.

## Agent Handoff Prompt

Do not implement an adapter until the owner supplies and approves the supplier-specific contract inputs listed in this plan. After approval, implement only the reviewed supplier integration. Use synthetic data in tests and docs, preserve idempotency, and do not write to Catalog or mutate Warehouse without validation and owner-approved gates.

## Completion Checklist

Planning/discovery slice:

- [x] Contract intake checklist documented
- [x] Required owner questions documented
- [x] Adapter implementation remains blocked
- [ ] Owner supplies missing supplier-specific contract inputs
- [ ] Owner approves conversion to coding prompt

Adapter implementation slice, blocked:

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented

## Change Note

- 2026-06-12: Draft execution plan created from backlog item.
- 2026-06-13: Added supplier-specific contract intake checklist and owner questions; adapter implementation remains blocked pending real supplier details and approval.
