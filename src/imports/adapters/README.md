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
