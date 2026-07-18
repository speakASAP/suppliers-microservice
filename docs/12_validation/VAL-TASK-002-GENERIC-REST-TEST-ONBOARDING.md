# VAL-TASK-002 Generic REST Test Onboarding

```yaml
id: VAL-TASK-002-GENERIC-REST-TEST-ONBOARDING
status: passed
owner: supplier-service-owner
created: 2026-06-21
last_updated: 2026-06-21
completeness_level: synthetic-runtime-complete
upstream:
  - docs/supplier-contracts/TASK-002_GENERIC_REST_ONBOARDING_APPROVAL.md
  - docs/supplier-contracts/TASK-002_SYNTHETIC_GENERIC_REST_TEST_SUPPLIERS.md
  - reports/validation/generic-rest-test-onboarding.js
```

## Summary

The owner-approved generic `rest` onboarding lane was executed with synthetic test suppliers only. Two active test supplier rows were created through the protected Suppliers API, each pointing to public synthetic HTTPS fixture payloads served by Suppliers itself. Validate-only imports completed for both suppliers.

## Intent Preservation Chain

- Vision: Suppliers remains the validation-first intake service for supplier product and stock feeds.
- Goal Impact: TASK-002 generic `rest` onboarding is runtime-proven with synthetic suppliers; real supplier onboarding still requires real supplier facts and separate approval.
- System: Supplier metadata, import jobs, payload validation, Catalog ownership boundaries, Warehouse stock authority, and idempotency remained separated.
- Feature: Generic production REST/JSON supplier onboarding.
- Task: Create/update synthetic test suppliers and run validate-only imports.
- Execution Plan: Deploy public fixture payloads, create/update approved test supplier rows, and run `reports/validation/generic-rest-test-onboarding.js`.
- Coding Prompt: No supplier-specific adapter code was needed.
- Code: Public synthetic fixtures and validation script only.
- Validation: Passed runtime script evidence below.

## Runtime Evidence

- Command: `SUPPLIERS_URL=https://suppliers.alfares.cz node reports/validation/generic-rest-test-onboarding.js`
- Token handling: a short-lived role-bearing JWT was generated from the runtime `JWT_SECRET` in memory and was not printed or committed.
- Base URL: `https://suppliers.alfares.cz`
- Supplier count: `2`
- Mutation mode: `validate_only`
- Warehouse mutation attempted: `false`

| Supplier code | Supplier ID | API operation | Import job ID | Job status | Total products | Payload validation | Warehouse validation | Warehouse attempted | Updated products |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | ---: |
| `codex-rest-test-a` | `63e362e6-8304-4f48-9abc-261f4138db7f` | `created` | `ddfbcde7-d22c-4126-a9e0-965e308b8f48` | `completed` | `2` | `passed` | `passed` | `false` | `0` |
| `codex-rest-test-b` | `ff4e2684-c067-49fb-a005-fe1f16a7a5cb` | `created` | `73e9f33a-4e39-49fc-ad8e-405cc69b1a3a` | `completed` | `1` | `passed` | `passed` | `false` | `0` |

## Boundary Decision

- No real supplier endpoint, credentials, raw production supplier payload, real SKU, real product ID, real warehouse ID, Catalog write, Warehouse mutation, cleanup mutation, object-storage mutation, or worker start was performed.
- `apiCredentials` were not supplied for the synthetic suppliers, and API responses confirmed `hasCredentials=false`.
- Catalog product validation was skipped because the imports were validate-only and did not request Warehouse mutation.
- Warehouse stock validation passed, but `warehouseStockUpdateAttempted=false`, `warehouseStockUpdateApproved=false`, and `updatedProducts=0` for both jobs.

## Remaining Real-Supplier Gate

Real supplier onboarding remains blocked until the owner supplies real supplier identity, endpoint/runtime reference plan, credential reference names, payload samples, product/category/warehouse mapping facts, and explicit approval for any real runtime import or Warehouse mutation.
