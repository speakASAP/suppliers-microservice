# Vision: suppliers-microservice

```yaml
id: VISION
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../BUSINESS.md
  - ../00_constitution/CONSTITUTION.md
downstream:
  - ../02_business_case/BUSINESS_CASE.md
  - ../04_systems/SYS-001-supplier-import-service.md
related_adrs: []
```

## Original Intent

The suppliers microservice automates product imports from supplier REST, XML, CSV, and compatible APIs into the Alfares catalog and stock ecosystem.

## Product Vision

The service provides a controlled supplier ingestion boundary that can connect to external suppliers, map supplier categories to catalog categories, run scheduled or manual imports, track import jobs, and pass validated product and stock updates to downstream services.

## Protected Goals

- Automate supplier product and stock import workflows.
- Support supplier API variability through REST, XML, CSV, and compatible source adapters.
- Maintain explicit category mappings from supplier categories to catalog categories.
- Track every import job with status and error evidence.
- Preserve idempotency so import jobs are safe to re-run.
- Keep supplier credentials out of committed source, docs, examples, and prompts.
- Prevent unvalidated supplier data from being pushed into the catalog.

## Consumers

The documented consumers are `flipflop-service` and `allegro-service`.

## Operational Boundary

The service runs on port `3202` and production is `https://supplier.alfares.cz`.

## Source References

- `BUSINESS.md`
- `README.md`
- `SYSTEM.md`
- `STATE.json`

## Change Note

- 2026-06-12: Initial IPS vision drafted from existing root documentation.
