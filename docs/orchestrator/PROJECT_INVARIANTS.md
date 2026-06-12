# Suppliers Project Invariants

- `SUPPLIERS-INV-001`: Suppliers owns import orchestration, import jobs, supplier metadata, and supplier category mappings.
- `SUPPLIERS-INV-002`: Catalog owns product and category truth; Warehouse owns stock truth; Auth owns identity; Logging owns log storage.
- `SUPPLIERS-INV-003`: Supplier credentials, tokens, private endpoints, decoded secrets, and raw production supplier payloads are sensitive and must not be persisted in docs, prompts, tests, or reports.
- `SUPPLIERS-INV-004`: Supplier data must be validated before any Catalog product write or Warehouse stock update.
- `SUPPLIERS-INV-005`: Imports must be idempotent and safe to re-run without duplicate product or stock effects.
- `SUPPLIERS-INV-006`: Category mappings must not redefine Catalog category identity.
- `SUPPLIERS-INV-007`: Supplier stock updates must preserve Warehouse as central stock authority.
- `SUPPLIERS-INV-008`: Production imports, downstream writes, stock mutation, and deployment require owner approval.
- `SUPPLIERS-INV-009`: Import failures must be observable without leaking sensitive payloads.
- `SUPPLIERS-INV-010`: Every implementation chunk must update status evidence and continuation state.
