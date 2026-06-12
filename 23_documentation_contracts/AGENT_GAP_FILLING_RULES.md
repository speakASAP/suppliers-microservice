# Agent Gap Filling Rules

## Purpose

These rules tell AI agents how to react when documentation is incomplete.

## Primary rule

Do not silently proceed through incomplete documentation. Either fill the gap from approved sources or mark it explicitly.

## Allowed actions

An agent may:

- Add missing required sections to mutable documents.
- Add `[MISSING: ...]` markers.
- Add `[UNKNOWN: ...]` markers.
- Create draft goal impact records.
- Create draft execution plans.
- Create semantic summaries from approved full documents.
- Update onboarding packages from existing approved documents.

## Forbidden actions

An agent must not:

- Modify immutable vision or constitution documents.
- Invent business goals.
- Invent approval status.
- Remove traceability links.
- Mark incomplete documents as validated.
- Convert a task into code without an approved execution plan.

## Gap remediation process

1. Identify the document type.
2. Load the required section list from `DOCUMENTATION_COMPLETENESS_STANDARD.md`.
3. Compare existing headings to required headings.
4. For each missing section:
   - Fill from approved upstream sources if possible.
   - Otherwise add `[MISSING: ...]`.
5. Update metadata `completeness_level`.
6. Add a short change note at the bottom of the document.

## Example remediation

Before:

```markdown
# Feature: Context Packages

## Scope
Generate context packages.
```

After:

```markdown
# Feature: Context Packages

## User or system need
AI agents need small, relevant context bundles.

## Goal impact
Supports the goal of reducing context-window overload.

## Scope
Generate context packages.

## Non-goals
[MISSING: define what this feature explicitly does not include]

## Acceptance criteria
[MISSING: define measurable acceptance criteria]
```
