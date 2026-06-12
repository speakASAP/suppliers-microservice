# ADR-001: Adopt Intent Preservation System

```yaml
id: ADR-001
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../01_vision/VISION.md
  - ../23_documentation_contracts/DOCUMENTATION_COMPLETENESS_STANDARD.md
downstream:
  - ../15_audits/AUDIT-2026-06-12-ips-bootstrap.md
related_adrs: []
```

## Context

The suppliers microservice had compact root-level documentation describing business intent, architecture, tasks, and state. The company standard requires traceable documentation that preserves intent from vision through tasks, execution plans, validation, and audits.

## Decision

Adopt the company Intent Preservation System structure inside the suppliers microservice repository and use it as the documentation source of truth for new work.

## Consequences

- New implementation work must trace to a feature, task, goal impact record, execution plan, and validation evidence.
- Supplier credentials and production data handling must be reviewed through documented sensitive-data rules.
- Root legacy docs remain useful source references but new planning should use IPS paths.
- Human approval is still required before marking draft AI-created docs as approved or validated.

## Alternatives Considered

- Keep only root-level docs: rejected because they do not provide enough traceability for company-standard AI-assisted delivery.
- Copy the reference IPS repository without project-specific content: rejected because it would create structure without preserved supplier intent.

## Change Note

- 2026-06-12: ADR created for IPS bootstrap.

## Validation

Run `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues` and confirm future implementation work uses IPS task and execution-plan gates.
