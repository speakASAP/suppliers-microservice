# CP-SUP-FRONTEND-ADMIN

## Source Context

- Runtime is NestJS with global `/api` prefix, CORS, validation pipe, TypeORM, and global JWT roles guard.
- Default protected roles are `global:superadmin` and `internal:suppliers-microservice:admin`.
- Public endpoints must use the existing `@Public()` decorator or static middleware outside `/api`.
- Supplier responses redact `apiCredentials` and expose `hasCredentials` only.
- Import jobs expose validation and Warehouse boundary evidence.
- Category mappings are supplier-owned references to Catalog category IDs; Catalog taxonomy remains owned by Catalog.

## Integrations To Visualize

- Supplier APIs feed scheduled/manual import jobs.
- Imports validate supplier payloads before downstream use.
- Category mappings connect supplier categories to Catalog category IDs.
- Warehouse receives only approved, validation-first stock reconciliation requests.
- FlipFlop, Allegro, and Orders consume downstream availability/product truth; Suppliers does not own those domains.

## UI Requirements

- Landing page presents value proposition, integrations, credential safety, and operator controls.
- Login page lets an authorized operator paste an existing JWT from Auth and stores it locally for protected API calls.
- Registration page is a customer-interest form and does not create identity records in Suppliers.
- Admin dashboard is gated by the token and reads protected data with `Authorization: Bearer <token>`.
