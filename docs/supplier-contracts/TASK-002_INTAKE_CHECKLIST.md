# TASK-002 Supplier Contract Intake Checklist

```yaml
id: TASK-002-SUPPLIER-CONTRACT-INTAKE-CHECKLIST
status: blocked-pending-owner-input
owner: supplier-service-owner
created: 2026-06-14
last_updated: 2026-06-21
completeness_level: owner-input-required
upstream:
  - BUSINESS.md
  - SYSTEM.md
  - README.md
  - TASKS.md
  - STATE.json
  - docs/orchestrator/GOALS.md
  - docs/orchestrator/PLAN.md
  - docs/IMPLEMENTATION_STATE.md
  - docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md
  - docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md
  - docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md
  - docs/intent-preservation/execution-plans/EP-TASK-002-CONTRACT-INTAKE.md
```

## Purpose

Use this owner-facing checklist before starting any TASK-002 supplier-specific API integration. Adapter implementation remains blocked until every required owner input is supplied, reviewed, and represented only as safe metadata, runtime secret reference names, or synthetic/masked examples.

## Intent Preservation Chain

- Vision: Suppliers is the controlled supplier import service for scheduled/manual supplier product and stock intake.
- Goal Impact: TASK-002 may unblock a real supplier integration only after the supplier contract is explicit and validation-first.
- System: `suppliers-microservice` stores supplier metadata, import jobs, category mappings, payload validation evidence, and idempotent orchestration.
- Feature: Supplier API integration for REST/XML/CSV/FTP or an approved compatible source.
- Task: Collect supplier-specific contract inputs without adding an adapter, secrets, production payloads, Catalog writes, Warehouse mutations, or deployment.
- Execution Plan: Convert the completed checklist into a reviewed execution plan before coding.
- Coding Prompt: Generate only after owner approval confirms the contract and allowed implementation scope.
- Code: Blocked until the execution plan is complete and pre-coding gates pass.
- Validation: Use synthetic contract tests, credential-reference checks, idempotency evidence, Catalog boundary evidence, Warehouse boundary evidence, strict documentation audit, and build validation.

## Repo-Derived Details

The current repo already provides a generic production REST/JSON contract in `docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md` and the derived TASK-002 boundary in `docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md`. Safely derived details are: adapter key `rest`, `apiType=rest`, HTTPS JSON GET by default, optional runtime credential reference names, JSON array or `{ "items": [...] }`, required `supplierSku` plus `stockQuantity`, optional `sourceRecordId`, `productId`, `warehouseId`, `supplierId`, and `observedAt`, deterministic replay keys, deterministic source fingerprints, and existing synthetic source checks. These details do not identify any real supplier and do not unblock adapter coding without the owner inputs below.

## Required Owner Inputs

| Area | Required owner input | Safe documentation format | Current status |
| --- | --- | --- | --- |
| Supplier identity | Display name, stable supplier code, business owner, technical owner, support/escalation contact, and whether the generic `rest` adapter is sufficient or a supplier-code-specific adapter is required. | Names and stable non-secret identifiers only; no private account IDs unless masked. | [DERIVED: generic `rest` adapter exists if supplier matches `PRODUCTION_REST_JSON_V1`; MISSING: real supplier identity and owner contacts] |
| Source endpoint | Protocol, integration type, endpoint or file source location, environment separation, TLS requirements, redirect policy, and allowed IP/network assumptions. | Describe endpoint class and runtime config key names; do not commit private URLs. | [MISSING: private endpoint or runtime endpoint reference plan] |
| Authentication shape | API key, bearer token, basic auth, OAuth/client credentials, mTLS, signed request, SFTP credential, or no-auth decision. | Runtime secret reference names only; no decoded values, auth headers, usernames, passwords, tokens, client secrets, or certificates. | [MISSING: authentication shape and credential reference names] |
| Credential reference plan | Exact env/config reference keys to be created, rotation owner, secret storage location, deployment process, and redaction expectations. | Reference key names and owner/process notes only. | [MISSING: credential reference plan] |
| Payload schema | Top-level response/file shape, item path, required/optional fields, source types, null handling, validation rules, and units/currency/date semantics. | Schema table plus synthetic examples only. | [DERIVED: generic REST accepts JSON array or `{ "items": [...] }`, required `supplierSku` and `stockQuantity`, optional `sourceRecordId`, `productId`, `warehouseId`, `supplierId`, `observedAt`; MISSING: confirmation the real supplier matches this shape or approved alternate schema] |
| Product mapping | Source SKU/product ID rules, product identity matching, title/description/brand/price fields, image/media handling, and Catalog product ownership expectations. | Field map with synthetic values and explicit Catalog write constraints. | [MISSING: product mapping assumptions] |
| Stock mapping | Quantity fields, warehouse/location identifiers, dropship versus supplier stock semantics, observed-at timestamp, and non-negative/integer rules. | Field map with synthetic values and Warehouse authority constraints. | [MISSING: stock and warehouse mapping assumptions] |
| Category mapping | Source category identifiers, expected category tree/list shape, required pre-approved Catalog category mappings, and missing/stale mapping behavior. | Source category field names and masked/synthetic IDs only. | [MISSING: category mapping assumptions] |
| Pagination and filters | Page/cursor/offset rules, page size limits, delta filters, since timestamps, full-sync rules, and end-of-data signal. | Contract notes and synthetic query examples only. | [MISSING: pagination and filter contract] |
| Rate limits and retries | Supplier rate limits, retryable status/error codes, backoff expectations, timeout ceilings, concurrency limit, and circuit-breaker expectations. | Numeric policy and sanitized error categories. | [MISSING: rate limits, retries, and timeout policy] |
| Sanitized sample shape | One minimal valid response/file sample, one representative full item, and malformed examples for validation tests. | Synthetic or masked examples only; no raw production payloads, private URLs, real SKUs, real product IDs, or credentials. | [MISSING: sanitized sample payload shape] |
| Idempotency rules | Stable source record identifier, source fingerprint basis, duplicate/replay behavior, deletion/discontinuation semantics, and retry safety expectations. | Deterministic rules with synthetic identifiers. | [DERIVED: generic REST replay key uses idempotency key plus `sourceRecordId`, and source fingerprint uses supplier code plus sorted source record IDs unless supplied; MISSING: real supplier record stability, deletion/discontinuation semantics, and delta policy] |
| Validation evidence | Owner review confirmation, contract completeness review, synthetic test plan, non-production smoke plan if needed, and approval boundary for any runtime check. | Checklist sign-off notes and command summaries only. | [MISSING: owner validation evidence and approval boundary] |

## Required Validation Questions

1. Which supplier is being onboarded, and what stable `supplier.code` should Suppliers use for adapter lookup and idempotency fingerprints?
2. Can the supplier use the existing `PRODUCTION_REST_JSON_V1` contract and `apiType=rest`, or does the source require a supplier-code-specific adapter?
3. What runtime configuration keys will hold the endpoint and credential references, and who owns creating and rotating them?
4. What exact payload shape should the adapter accept, and which fields are required before any Catalog or Warehouse-bound candidate is produced?
5. What synthetic or masked payload sample can be committed for contract tests?
6. How are source records uniquely identified, and what changes should create a new source fingerprint versus a replay of the same data?
7. Which category mappings must exist before import can proceed, and how should missing/stale mappings be surfaced to the owner?
8. Which stock quantities are supplier-managed, dropship, or warehouse-specific, and what Warehouse reconciliation path is allowed after validation?
9. What pagination, delta-sync, timeout, retry, and rate-limit rules must the import job obey?
10. What non-production or synthetic validation evidence must pass before the owner approves any real runtime onboarding?
11. Confirm whether the next coding slice should onboard through the generic `rest` adapter, create a supplier-code-specific adapter, or remain blocked.
12. Confirm which runtime action, if any, needs a separate owner approval after source-only validation passes.

## Adapter Implementation Blockers

Repo-derived details are now documented, but execution-critical external facts remain missing.

- [MISSING: supplier identity]
- [MISSING: endpoint/runtime endpoint reference]
- [MISSING: authentication shape]
- [MISSING: credential reference plan]
- [MISSING: payload schema]
- [MISSING: pagination, filters, retry, timeout, and rate-limit rules]
- [MISSING: sanitized synthetic or masked sample]
- [MISSING: product, stock, and category mapping assumptions]
- [MISSING: source record ID and idempotency rules]
- [MISSING: owner validation evidence and approval boundary]

Do not mark Goal 9 or TASK-002 unblocked until the blockers above are resolved with reviewed, non-secret, non-production-safe documentation.

## Acceptance Criteria For Unblocking Coding

- A completed supplier contract document exists under `docs/supplier-contracts/` using `SUPPLIER_CONTRACT_TEMPLATE.md` or an approved equivalent.
- The contract contains no decoded secrets, auth headers, private endpoints, raw production payloads, real SKUs, or real product/customer identifiers.
- Runtime secret values are referenced only by agreed env/config key names.
- Synthetic contract fixtures cover valid payloads, malformed payloads, idempotency/replay behavior, pagination/rate-limit behavior where applicable, and sanitized error handling.
- Category mapping, Catalog ownership, Warehouse stock authority, and mutation approval boundaries are explicit.
- The execution plan and coding prompt are generated from the completed contract and pass the pre-coding gate before source edits.

## Forbidden During Intake

Do not implement an adapter, inspect or print secrets, query raw production supplier payloads, run a production import, write Catalog products, mutate Warehouse stock, deploy, run cleanup mutation, or infer missing supplier details from assumptions.

## Documentation-Only Validation

Recommended checks after this checklist changes:

```bash
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
git diff --check
rg -n "Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}" docs/supplier-contracts docs/orchestrator docs/intent-preservation 14_prompts AGENTS.md TASKS.md
rg -n "(client[_-]?secret|password|private[_-]?key|api[_-]?key)" docs/supplier-contracts docs/orchestrator docs/intent-preservation 14_prompts AGENTS.md TASKS.md
```
