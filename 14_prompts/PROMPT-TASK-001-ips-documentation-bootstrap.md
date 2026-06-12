# PROMPT-TASK-001: IPS Documentation Bootstrap

```yaml
id: PROMPT-TASK-001
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../21_execution_plans/EP-TASK-001-ips-documentation-bootstrap.md
downstream: []
related_adrs: []
```

## Role

Documentation agent preserving supplier-service intent under the company IPS standard.

## Task

Create and validate the IPS documentation bootstrap for `suppliers-microservice`.

## Context

Use `BUSINESS.md`, `README.md`, `SYSTEM.md`, `TASKS.md`, source module structure, and the company IPS contracts.

## Constraints

Do not change runtime code, expose credentials, invent approvals, or mark draft intent documents as human-approved.

## Acceptance criteria

- IPS documentation structure exists.
- Current backlog has traceable tasks and execution plans.
- Strict documentation audit and pre-coding gate pass or findings are recorded.

## Validation

Run `python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues` and `python3 scripts/pre_coding_gate.py --root .`.

## Change Note

- 2026-06-12: Minimal prompt added for implemented documentation bootstrap graph compliance.
