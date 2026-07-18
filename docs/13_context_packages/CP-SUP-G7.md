# CP-SUP-G7 - Warehouse Reconciliation Client Context

Suppliers currently validates normalized payload shape and Warehouse stock boundary but does not call Warehouse. Warehouse exposes `POST /api/supplier-reconciliations`, protected by service auth, for supplier/dropship stock reconciliation. The request requires supplierId, warehouseId, productId, quantity, externalReference, actor, and optional observedAt.

The target behavior is not a supplier-specific adapter. It is the internal handoff layer that future adapters use after payload, category, Catalog product, and Warehouse stock validation pass. Default import runs must remain non-mutating. Warehouse calls occur only when mutation is explicitly approved in the run context and valid normalized stock candidates are supplied.

No credentials or production payloads are needed. Runtime Warehouse URL and bearer token must come from env vars.
