# Supplier Contract Template

```yaml
id: SUPPLIER-CONTRACT-TEMPLATE
status: template
owner: supplier-service-owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
```

## Purpose

Use this template before implementing a real supplier adapter. Fill it with approved supplier details using synthetic or masked examples only.

## Supplier Identity

- Supplier display name:
- Supplier code:
- Adapter key:
- Source type: `rest`, `xml`, `csv`, `ftp`, or approved compatible source.

## Source Endpoint

Describe the endpoint or file source without storing private URLs in committed docs. Store private endpoints in runtime configuration only.

## Authentication References

List runtime secret reference names only. Do not include decoded API keys, passwords, tokens, usernames, or authorization headers.

## Fetch Rules

Document pagination, date filters, file naming, retry behavior, timeout expectations, rate limits, and error codes.

## Product Fields

List required and optional product fields, source field names, normalized field names, data types, validation rules, and default handling.

## Stock Fields

List required and optional stock fields, warehouse identifiers, quantity rules, observed-at semantics, and stock validation rules.

## Category Fields

List source category identifiers and category mapping expectations. Missing mappings must block Catalog writes.

## Replay And Idempotency

Define deterministic source record identifiers, source fingerprints, replay keys, duplicate handling, and retry expectations.

## Synthetic Samples

Include synthetic payload samples only. Do not include raw production payloads, private supplier identifiers, real SKUs, credentials, or private endpoints.

## Error Handling

Define sanitized error categories and which details may be logged without exposing credentials or production payloads.

## Approval

Record owner review and implementation approval outside this template when a real supplier contract is ready.
