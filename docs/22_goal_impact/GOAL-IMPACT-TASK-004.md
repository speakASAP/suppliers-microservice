# GOAL-IMPACT-TASK-004: Preserve Warehouse stock authority during supplier imports.

```yaml
id: GOAL-IMPACT-TASK-004
artifact_type: task
artifact_id: TASK-004
artifact_path: ../11_tasks/TASK-004-review-warehouse-stock-update-boundary.md
primary_goal: Preserve Warehouse stock authority during supplier imports.
impact_level: high
status: draft
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream_links:
  - ../01_vision/VISION.md
  - ../02_business_case/BUSINESS_CASE.md
  - ../11_tasks/TASK-004-review-warehouse-stock-update-boundary.md
upstream:
  - ../11_tasks/TASK-004-review-warehouse-stock-update-boundary.md
downstream:
  - ../21_execution_plans/EP-TASK-004-review-warehouse-stock-update-boundary.md
related_adrs: []
```

## Explanation

Supplier imports may contain stock data, but Warehouse remains the source of stock truth. Suppliers can validate and pass candidates only after actor, reason, idempotency, and failure behavior are explicit.

## Evidence

`VISION`, `BUSINESS.md`, and project invariants require supplier data validation before downstream stock effects and preserve Warehouse stock ownership.

## Validation

Validate by confirming no Warehouse mutation path is introduced, malformed stock candidates fail validation, and import-job evidence records the stock-boundary decision without sensitive production data.

## Change Note

- 2026-06-13: Goal impact record created for Goal 5.
