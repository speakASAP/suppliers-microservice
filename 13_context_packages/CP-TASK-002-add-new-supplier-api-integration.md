# CP-TASK-002: Add New Supplier API Integration

```yaml
id: CP-TASK-002
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../11_tasks/TASK-002-add-new-supplier-api-integration.md
  - ../21_execution_plans/EP-TASK-002-add-new-supplier-api-integration.md
downstream: []
related_adrs: []
```

## Target task

TASK-002: `../11_tasks/TASK-002-add-new-supplier-api-integration.md`

## Upstream traceability

- `../01_vision/VISION.md`
- `../02_business_case/BUSINESS_CASE.md`
- `../10_features/FEAT-001-supplier-api-integration.md`
- `../21_execution_plans/EP-TASK-002-add-new-supplier-api-integration.md`

## Included documents

- `../17_governance/PROJECT_INVARIANTS.md`
- `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`
- `../03_domain_model/CORE_ENTITIES.md`

## Excluded documents

- `.env`
- `.env.backup*`
- Raw supplier payloads
- Production credentials

## Constraints

No real credentials, no unvalidated Catalog writes, no unapproved Warehouse mutation, preserve import idempotency, and handle mapping gaps explicitly. Do not store private supplier URLs, decoded credentials, authorization headers, raw production payloads, real SKUs, real product IDs, or customer data in committed artifacts.

## Contract Intake Context

TASK-002 is blocked for adapter implementation until the owner supplies a real supplier-specific contract and approval. The intake checklist in `../21_execution_plans/EP-TASK-002-add-new-supplier-api-integration.md` is the controlling source for required inputs. Current missing execution-critical inputs are:

- [MISSING: real supplier identity and stable supplier code]
- [MISSING: private endpoint or file-source descriptor stored outside committed docs]
- [MISSING: authentication shape]
- [MISSING: runtime credential reference plan]
- [MISSING: payload schema]
- [MISSING: pagination behavior]
- [MISSING: rate limits and retry policy]
- [MISSING: supplier error model]
- [MISSING: deterministic idempotency/source-record rules]
- [MISSING: category mapping requirements]
- [MISSING: Catalog and Warehouse boundary expectations]
- [MISSING: sanitized sample request, response, empty-page, malformed-payload, and error examples]
- [MISSING: owner approval to convert this package into a coding prompt]

## Owner Questions

1. What real supplier identity and stable internal supplier code should TASK-002 target?
2. Where is the private endpoint or file-source descriptor configured outside committed docs?
3. Which authentication scheme is required, and which runtime credential reference names should be used?
4. What product, stock, category, pagination, and error schema must the adapter validate?
5. What rate limits, timeout budget, retryable statuses, and backoff rules apply?
6. Which fields define source record IDs, supplier SKUs, source fingerprints, and replay keys?
7. What category mappings are required before Catalog writes, and how should missing or ambiguous mappings block work?
8. Which product fields may Suppliers propose to Catalog, and which stock fields may Suppliers propose to Warehouse?
9. Can the owner provide sanitized synthetic examples that preserve shape without raw production data?
10. Does the owner approve converting this intake package into a coding prompt after all blockers are resolved?

## Agent prompt

Use this package for intake only until the execution plan is reviewed and owner-supplied contract details are present. Do not implement a supplier adapter from this package alone. When unblocked, implement only the approved supplier integration using synthetic or masked data in tests and reports.

## Validation instructions

For this planning/discovery slice, run `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues` and `git diff --check` after documentation changes. For future adapter work after owner approval, run `npm run build`, pre-coding gate, sensitive-data review, supplier contract validation, malformed-payload checks, and replay/idempotency validation before completion.

## Change Note

- 2026-06-12: Context package aligned to IPS audit contract.
- 2026-06-13: Added TASK-002 supplier-specific contract intake context, missing-input blockers, and owner questions; adapter implementation remains blocked.
