# FEAT-002: Category Mapping

```yaml
id: FEAT-002
status: implemented
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../05_subsystems/SUB-003-category-mapping.md
downstream:
  - ../11_tasks/TASK-003-review-category-mapping-completeness.md
related_adrs: []
```

## User or system need

Operations and import workflows need a reliable mapping from supplier category identifiers to catalog category identifiers.

## Goal impact

Protects catalog quality by preventing unmapped or incorrectly mapped supplier category data from being treated as catalog-ready.

## Scope

- Store and update supplier-category mappings.
- Retrieve mappings per supplier.
- Review completeness for active suppliers.
- Define handling for missing mappings in import workflows.

## Non-goals

- Owning catalog taxonomy.
- Automatically approving mappings without review.
- Embedding production category dumps in documentation.

## Acceptance criteria

- Mapping upsert preserves unique supplier-category relationship.
- Mapping completeness can be reviewed for active supplier inputs.
- Missing mapping behavior is documented before downstream imports depend on it.
- Catalog category identity remains Catalog-owned; Suppliers stores only selected Catalog category IDs.

## Dependencies

- Supplier registry.
- Catalog category identifiers.
- Import validation rules.

## Validation strategy

Run build checks, repository tests when added, mapping completeness review queries or scripts, and sensitive-data review for generated reports.

## Change Note

- 2026-06-12: Initial feature created from backlog item.
- 2026-06-13: Implemented DTO validation and a supplied-category completeness check for Goal 4.

## Traceability

`../01_vision/VISION.md`, `../05_subsystems/SUB-003-category-mapping.md`, `../11_tasks/TASK-003-review-category-mapping-completeness.md`.

## Goal

Explicit supplier-category to catalog-category mapping.

## Validation

`npm run build` and the task-specific IPS gates pass before implementation is accepted.
