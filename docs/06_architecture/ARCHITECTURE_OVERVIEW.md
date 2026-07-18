# Architecture Overview

```yaml
id: ARCHITECTURE-OVERVIEW
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../04_systems/SYS-001-supplier-import-service.md
downstream:
  - ../07_decisions/ADR-001-adopt-intent-preservation-system.md
related_adrs:
  - ADR-001
```

## Runtime

The service is a NestJS application using TypeScript, TypeORM, PostgreSQL, global validation pipes, CORS, a global `/api` prefix, and a JWT roles guard.

## Modules

- `SuppliersModule`: supplier registry.
- `ImportsModule`: import job creation, listing, and execution orchestration.
- `MappingsModule`: category mapping.
- `HealthModule`: health check.
- `LoggerModule`: service logging.
- `AuthModule`: JWT and role guard support.

## Persistence

PostgreSQL tables are represented by TypeORM entities: `Supplier`, `ImportJob`, and `CategoryMapping`.

## Integrations

- Database: `db-server-postgres:5432`.
- Catalog: `catalog-microservice:3200`.
- Warehouse: `warehouse-microservice:3201`.
- Logging: `logging-microservice:3367`.

## Security and Data Handling

Supplier credentials are sensitive. They must be supplied through runtime environment configuration and excluded from docs, prompts, examples, logs, and validation reports.

## Deployment

The deployment script is `scripts/deploy.sh`. Kubernetes manifests live in `k8s/`. Production endpoint is `https://supplier.alfares.cz`.

## Validation

The minimum validation command before delivery is `npm run build`. Documentation-related changes must also run IPS gates when scripts are available.

## Change Note

- 2026-06-12: Initial architecture overview created from source and root docs.
