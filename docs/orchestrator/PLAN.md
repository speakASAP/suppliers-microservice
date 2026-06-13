# Suppliers Implementation Plan

Work one owner-approved goal chunk at a time. Default next goal is Goal 5 - Warehouse Stock Update Boundary.

Workflow: read source-of-truth docs, query DocsRAG when available, select active/earliest pending goal, create goal artifacts, run pre-coding gate, implement only selected chunk, validate, append `docs/orchestrator/STATUS.md`, update `docs/IMPLEMENTATION_STATE.md`, `TASKS.md`, and `STATE.json` when state changes.

Documentation-only validation:
```bash
find docs/orchestrator docs/intent-preservation implementation-goals -maxdepth 3 -type f -name '*.md' -print
rg '\[(MISSING|UNKNOWN):' docs/orchestrator docs/intent-preservation docs/IMPLEMENTATION_ORCHESTRATOR.md docs/IMPLEMENTATION_STATE.md implementation-goals AGENTS.md
rg -n 'Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}|(client[_-]?secret|password|private[_-]?key|api[_-]?key)\s*[:=]\s*["'"']?[A-Za-z0-9_./+=:-]{12,}' docs AGENTS.md TASKS.md implementation-goals
```
