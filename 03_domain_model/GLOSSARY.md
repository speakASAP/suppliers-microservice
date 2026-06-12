# Glossary

```yaml
id: GLOSSARY
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../01_vision/VISION.md
  - ../02_business_case/BUSINESS_CASE.md
downstream:
  - ./CORE_ENTITIES.md
related_adrs: []
```

## Terms

- Supplier: External product or stock provider configured in the suppliers service.
- Supplier API: REST, XML, CSV, FTP, or compatible source used to fetch supplier data.
- Supplier credentials: Secret values used to authenticate to supplier APIs. These are sensitive and environment-managed.
- Import job: A tracked execution record for a supplier import run.
- Category mapping: Relationship from a supplier category identifier to a catalog category identifier.
- Catalog service: Downstream service on port `3200` that receives validated product information.
- Warehouse service: Downstream service on port `3201` that receives validated stock information.
- Idempotency: The property that a supplier import can be safely re-run without unsafe duplicate effects.
- Validation: Checks required before supplier data is accepted for downstream catalog or stock writes.

## Change Note

- 2026-06-12: Initial glossary created from service docs and entities.
