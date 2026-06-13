# Production REST JSON Supplier Contract v1

```yaml
id: PRODUCTION-REST-JSON-V1
status: active
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
adapter_key: rest
```

## Purpose

This is the first production supplier contract owned by `suppliers-microservice`. It defines the generic REST/JSON adapter used for supplier records with `apiType=rest` when no supplier-specific adapter key is registered by supplier code.

## Supplier Metadata

A supplier record must provide:

- `apiType`: `rest`
- `apiUrl`: HTTPS endpoint returning this contract shape.
- `apiCredentials`: runtime secret reference names only, optional.

## Authentication

Credential values are never stored in source or docs. When credential references are present, the adapter resolves them from runtime environment variables:

- `apiKeyRef`: sent as `X-API-Key`.
- `tokenRef`: sent as `Authorization: Bearer <runtime value>`.
- `usernameRef` and `passwordRef`: sent as HTTP Basic auth only when both refs resolve.

## Response Shape

The endpoint must return either a JSON array or an object with an `items` array.

Each item must include:

- `supplierSku`: non-empty string.
- `stockQuantity`: non-negative integer.

Each item may include:

- `sourceRecordId`: non-empty string. Defaults to `supplierSku` when omitted.
- `productId`: non-empty string when known.
- `warehouseId`: non-empty string when stock reconciliation is intended.
- `observedAt`: ISO timestamp string when known.

## Replay And Idempotency

The adapter computes deterministic replay keys from the import idempotency key and source record ID. The source fingerprint is either caller-supplied or derived from supplier code and sorted source record IDs.

## Validation

Source validation is maintained by `reports/validation/synthetic-production-rest-json-adapter-check.js`. The check uses a mocked HTTP client, synthetic runtime secret references, and synthetic payloads only. It proves credential-reference resolution, deterministic replay keys, deterministic source fingerprints, normalized payload validation, and malformed payload blocking without making external calls.

## Downstream Boundaries

Adapter output must pass existing supplier payload validation before downstream work. Catalog writes and Warehouse stock mutation remain governed by their existing validation and approval gates.

## Synthetic Example

```json
{
  "items": [
    {
      "supplierSku": "SYN-SKU-001",
      "stockQuantity": 5,
      "sourceRecordId": "source-record-001",
      "productId": "product-synthetic",
      "warehouseId": "warehouse-synthetic",
      "observedAt": "2026-06-13T10:00:00.000Z"
    }
  ]
}
```

## Prohibited Content

Do not store private supplier URLs, decoded credentials, raw production payloads, real SKUs, real product IDs, authorization headers, or supplier secrets in committed artifacts.
