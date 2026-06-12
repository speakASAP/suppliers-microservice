# CP-TASK-002: Add New Supplier API Integration

```yaml
id: CP-TASK-002
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
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

No real credentials, no unvalidated catalog writes, preserve import idempotency, and handle mapping gaps explicitly.

## Agent prompt

Use this package only after the execution plan is reviewed. Implement only the approved supplier integration using synthetic or masked data in tests and reports.

## Validation instructions

Run `npm run build`, pre-coding gate, sensitive-data review, contract validation, and replay/idempotency validation before completion.

## Change Note

- 2026-06-12: Context package aligned to IPS audit contract.
