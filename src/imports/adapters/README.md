# Supplier Import Adapters

This directory contains the Suppliers-owned adapter contract and registry.

Current boundary:

- No real supplier adapter is implemented here yet.
- Real supplier adapters require an owner-supplied supplier contract.
- Adapters must emit deterministic `sourceRecordId`, `replayKey`, and `sourceFingerprint` values before downstream work.
- Adapter output must pass synthetic contract validation before Catalog or Warehouse writes.
- Supplier credentials must remain runtime secret references and must not be committed here.
