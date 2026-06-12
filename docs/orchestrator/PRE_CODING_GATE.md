# Suppliers Pre-Coding Gate

Coding is blocked unless the selected task has: selected goal/chunk, upstream traceability, preserved intent, invariant impact, sensitive-data classification, credential handling, supplier payload validation impact, Catalog contract impact, Warehouse contract impact, category mapping impact, replay/idempotency impact, exact files to inspect/modify, validation commands, and remote git status.

Block when supplier credential handling is unclear, validation before downstream writes is unclear, idempotency/retry behavior is unclear, category mapping impact is missing, ownership boundaries are ambiguous, secrets/raw production data could leak, or production import/mutation/deployment lacks owner approval.

Data classification: `none`, `synthetic`, `masked`, or `sensitive`. Supplier credentials and decoded runtime secrets are always `sensitive`.
