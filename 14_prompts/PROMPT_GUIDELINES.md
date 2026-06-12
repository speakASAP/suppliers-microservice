# Prompt Guidelines

```yaml
id: PROMPT-GUIDELINES
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../23_documentation_contracts/DOCUMENTATION_COMPLETENESS_STANDARD.md
  - ../17_governance/PROJECT_INVARIANTS.md
downstream:
  - ./PROMPT-TASK-002-add-new-supplier-api-integration.md
related_adrs: []
```

## Rules

- Generate coding prompts only from reviewed task and execution plan documents.
- Include allowed files, forbidden files, validation commands, and acceptance criteria.
- Do not include real supplier credentials or raw production supplier payloads.
- Include sensitive-data and idempotency requirements for import work.
- Require validation report updates before completion.

## Change Note

- 2026-06-12: Initial prompt guidelines created.
