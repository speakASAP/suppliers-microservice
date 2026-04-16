# Business: suppliers-microservice
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Automated product imports from supplier REST/XML/CSV APIs with category mapping and scheduled sync.

## Constraints

- AI must never push supplier data to catalog without validation
- Supplier credentials managed in .env only
- Import jobs must be idempotent (safe to re-run)

## Consumers

flipflop-service, allegro-service.

## SLA

- Port: 3202 (<http://suppliers-microservice:3202>)
- Production: <https://supplier.alfares.cz>
