# Suppliers Readiness Gates

Integration readiness requires pre-coding gate decision, changed files, invariant review, sensitive-data and credential scan result, supplier payload validation result, Catalog contract result, Warehouse contract result, category mapping result, idempotency result, validation commands, and known deviations.

Deployment readiness additionally requires explicit owner approval, deployment result, health check, synthetic/masked smoke evidence, and confirmation no secrets or production payloads were captured.

Documentation-only changes require documentation presence, unresolved-marker, and secret-pattern scans. Decision values: `accept`, `accept-with-follow-up`, or `block`.
