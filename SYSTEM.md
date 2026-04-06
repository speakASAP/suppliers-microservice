# System: suppliers-microservice

## Architecture

NestJS + PostgreSQL. Scheduled imports from supplier APIs (REST/XML/CSV).

- Category mapping: supplier categories → catalog categories
- Import jobs: trackable with status (pending/running/done/failed)

## Integrations

| Dependency | URL |
|-----------|-----|
| database-server | db-server-postgres:5432 |
| logging-microservice | logging-microservice:3367 |
| catalog-microservice | catalog-microservice:3200 |

## Current State
<!-- AI-maintained -->
Stage: production

## Known Issues
<!-- AI-maintained -->
- None
