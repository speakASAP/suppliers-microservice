# Suppliers Intent Preservation

## Original Intent
Suppliers automates product imports from supplier REST/XML/CSV APIs with category mapping and scheduled sync. It must never push supplier data to Catalog without validation, supplier credentials must be managed in environment/runtime secrets only, and import jobs must be idempotent and safe to re-run.

## Preserved Intent
Suppliers remains a validation-first import orchestration service: store supplier metadata without exposing credentials, run trackable imports, validate supplier payloads before Catalog or Warehouse writes, preserve supplier-to-Catalog category mappings, send product data to Catalog as product truth owner, send stock data to Warehouse as stock truth owner, and make retries deterministic.

## Rules
1. Suppliers owns supplier records, API metadata, import jobs, status, mappings, orchestration, and supplier payload validation.
2. Catalog owns product identity, sellable content, and category truth.
3. Warehouse owns stock quantities, reservations, movements, and availability truth.
4. Auth owns login, JWT, RBAC, and service identity.
5. Logging owns centralized log storage.
6. Supplier credentials, API keys, passwords, tokens, private endpoints, decoded secrets, and raw production supplier payloads must not appear in docs, prompts, tests, reports, screenshots, or command output.
7. Supplier payloads must be validated before downstream writes.
8. Import jobs must be idempotent and safe to retry.
9. Production imports, Catalog writes, Warehouse stock mutations, and deployment require explicit owner approval in the active session.
