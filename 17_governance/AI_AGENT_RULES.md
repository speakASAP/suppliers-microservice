# AI Agent Rules

```yaml
id: AI-AGENT-RULES
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ./PROJECT_INVARIANTS.md
  - ../23_documentation_contracts/AGENT_GAP_FILLING_RULES.md
downstream: []
related_adrs: []
```

## Rules

- Read `AGENTS.md` and this document before making changes.
- Work on the remote repository when the task is remote-server work.
- Do not modify immutable intent documents unless explicitly authorized by the owner.
- Do not invent business goals or approvals.
- Do not write code from a vague task; require a reviewed execution plan.
- Use `[MISSING: ...]` or `[UNKNOWN: ...]` markers instead of hiding gaps.
- Never expose supplier credentials or raw sensitive supplier payloads.
- Record validation evidence for implementation work.

## Change Note

- 2026-06-12: Initial AI agent rules created.
