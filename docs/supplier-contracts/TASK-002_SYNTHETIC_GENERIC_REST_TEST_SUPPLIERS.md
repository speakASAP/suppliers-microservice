# TASK-002 Synthetic Generic REST Test Suppliers

```yaml
id: TASK-002-SYNTHETIC-GENERIC-REST-TEST-SUPPLIERS
status: runtime-validation-passed
owner: supplier-service-owner
created: 2026-06-21
last_updated: 2026-06-21
completeness_level: synthetic-runtime-complete
upstream:
  - docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md
  - docs/supplier-contracts/TASK-002_GENERIC_REST_ONBOARDING_APPROVAL.md
  - reports/validation/generic-rest-test-onboarding.js
```

## Purpose

Define owner-approved synthetic supplier metadata for generic REST onboarding validation. These suppliers are test fixtures only and must not be treated as real commercial suppliers.

## Intent Preservation Chain

- Vision: Suppliers remains the validation-first intake service for supplier product and stock feeds.
- Goal Impact: TASK-002 can prove the generic `rest` onboarding path with synthetic data before any real supplier is added.
- System: Supplier metadata, import jobs, category mappings, Catalog ownership boundaries, Warehouse stock authority, and idempotency remain separated.
- Feature: Generic production REST/JSON supplier onboarding.
- Task: Create/update synthetic test supplier rows and run validate-only imports.
- Execution Plan: Deploy public synthetic fixture files, then run `reports/validation/generic-rest-test-onboarding.js` with a protected Suppliers API token.
- Coding Prompt: No supplier-specific adapter prompt is needed.
- Code: Public synthetic fixtures plus validation script only; no adapter source behavior changes.
- Validation: Runtime script must create/update test suppliers, run validate-only imports, and prove no Warehouse mutation was attempted or approved.

## Synthetic Supplier Rows

| Name | Code | API type | Fixture URL | Credentials |
| --- | --- | --- | --- | --- |
| Codex Generic REST Test Supplier A | `codex-rest-test-a` | `rest` | `https://suppliers.alfares.cz/supplier-fixtures/generic-rest-test-a.json` | none |
| Codex Generic REST Test Supplier B | `codex-rest-test-b` | `rest` | `https://suppliers.alfares.cz/supplier-fixtures/generic-rest-test-b.json` | none |

## Runtime Boundary

- Supplier rows may be created or updated for these two test codes only.
- Imports must use `warehouseStockUpdateMode=validate_only`.
- No supplier credentials, private endpoint, raw production payload, real SKU, real product ID, real warehouse ID, Catalog write, Warehouse mutation, cleanup mutation, or worker start is authorized by this synthetic test.
- The fixture files are public synthetic data served by Suppliers itself over HTTPS to exercise the generic REST adapter without external supplier dependencies.


## Runtime Result

The synthetic onboarding run passed on 2026-06-21. Test supplier rows were created for `codex-rest-test-a` and `codex-rest-test-b`; validate-only imports completed with payload validation and Warehouse boundary validation passed, and no Warehouse mutation attempted or approved. Detailed evidence is recorded in `docs/12_validation/VAL-TASK-002-GENERIC-REST-TEST-ONBOARDING.md`.
