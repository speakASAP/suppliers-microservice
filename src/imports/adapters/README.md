# Supplier Import Adapters

This directory contains the Suppliers-owned adapter contract and registry.

Current boundary:

- No real supplier adapter is implemented here yet.
- Real supplier adapters require an owner-supplied supplier contract.
- Adapters must emit deterministic `sourceRecordId`, `replayKey`, and `sourceFingerprint` values before downstream work.
- Adapter output must pass synthetic contract validation before Catalog or Warehouse writes.
- Supplier credentials must remain runtime secret references and must not be committed here.


## Synthetic Trace Adapter

A synthetic-only adapter is registered under `synthetic-trace` for owner-approved cross-service smoke tests. It requires `sourceFingerprint` in the format `trace:<productId>:<warehouseId>:<quantity>[:supplierSku]` and emits one normalized stock candidate. It must not be used for real supplier integrations or credentials.

## Production REST JSON Adapter

The generic production adapter is registered under `rest` and follows `docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md`. It is selected for active suppliers with `apiType=rest` when no supplier-code-specific adapter is registered.

The adapter reads only supplier metadata and runtime credential reference names. It requires an HTTPS `apiUrl` by default, disables redirects, accepts a JSON array or `{ "items": [...] }`, normalizes `supplierSku`, `stockQuantity`, optional product/warehouse fields, and creates deterministic replay metadata before downstream validation.
