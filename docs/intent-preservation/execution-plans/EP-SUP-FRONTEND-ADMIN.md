# EP-SUP-FRONTEND-ADMIN

```yaml
id: EP-SUP-FRONTEND-ADMIN
status: done
owner: supplier-service-owner
created: 2026-06-13
upstream:
  - BUSINESS.md
  - SYSTEM.md
  - README.md
  - docs/06_architecture/ARCHITECTURE_OVERVIEW.md
  - docs/16_operations/INTEGRATIONS.md
```

## Goal

Create a public landing page and an authenticated admin dashboard frontend for `suppliers-microservice`.

## Allowed Scope

- Add static frontend assets under `public/`.
- Add Nest static serving and fallback routing needed for `/`, `/login`, `/register`, and `/admin`.
- Use existing protected APIs for supplier, import, and mapping data.
- Use client-side bearer JWT storage only for operator-provided tokens.

## Non-Goals

- Do not implement identity ownership in Suppliers.
- Do not store or display raw supplier credentials.
- Do not mutate Catalog, Warehouse, marketplace, or supplier production data.
- Do not add supplier-specific adapter contracts without owner-supplied supplier details.

## Invariant Review

Suppliers remains the controlled validation-first supplier import service. The frontend may visualize supplier metadata, import status, mapping status, service interconnections, and safe credential reference presence, but it must not bypass payload validation, idempotency, Catalog ownership, Warehouse ownership, or credential-safety boundaries.

## Sensitive Data Classification

No real supplier payloads, production exports, secrets, or decoded credentials are added. UI copy must refer to credential references and `hasCredentials` only.

## Contract Impact

The admin dashboard reads existing Suppliers-owned endpoints. Catalog and Warehouse are represented as downstream integration targets only. No Catalog product write, Warehouse stock mutation, or consumer marketplace ownership is introduced.

## Validation Plan

- `python3 scripts/pre_coding_gate.py --root .`
- `npm run build`
- Static route smoke checks for `/`, `/login`, `/register`, `/admin`, and `/assets/app.js`.
- Verify unauthenticated admin UI requires a token before loading protected data.
- `python3 scripts/deployment_readiness_gate.py --root . --target SUP-FRONTEND-ADMIN`
