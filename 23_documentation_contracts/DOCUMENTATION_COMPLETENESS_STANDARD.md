# Documentation Completeness Standard

## Purpose

This standard defines how documents must be structured so that humans and AI agents can detect incomplete documentation and safely fill missing sections.

The system should make incompleteness explicit instead of hiding it inside vague prose.

## Completeness levels

```yaml
completeness_level: missing | skeletal | partial | complete | validated
```

Definitions:

- `missing`: Document does not exist.
- `skeletal`: Document exists but contains mostly headings or placeholders.
- `partial`: Document contains useful content but lacks required sections.
- `complete`: All required sections exist and contain meaningful content.
- `validated`: Complete and reviewed against upstream intent.

## Required metadata block

Every major document should start with:

```yaml
id: DOC-ID
status: draft | reviewed | approved | deprecated
owner: TBD
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
completeness_level: skeletal | partial | complete | validated
upstream:
  - path/to/upstream.md
downstream:
  - path/to/downstream.md
related_adrs:
  - ADR-xxx
```

## Missing information marker

Use this exact marker when information is missing:

```text
[MISSING: describe what is missing and who should provide it]
```

Examples:

```text
[MISSING: define measurable acceptance criteria for this feature]
[MISSING: identify upstream business goal]
[MISSING: list files that must not be modified]
```

## Unknown information marker

Use this exact marker when something is genuinely unknown:

```text
[UNKNOWN: describe what is unknown and how to discover it]
```

## Agent fill-in rule

An AI agent may fill a missing section only when:

1. The required information can be derived from upstream approved documents.
2. The agent cites the source document path.
3. The agent marks the section as `ai-draft` if human review is required.
4. The agent does not change immutable documents.

If information cannot be derived, the agent must leave a `[MISSING: ...]` marker.

## Meaningful content rule

A section is not complete if it contains only:

- TBD
- N/A
- Placeholder
- To be filled
- Empty bullet list
- Generic filler text

## Required sections by document type

### Vision Evolution Entry

- Summary
- Reason
- Original vision reference
- Affected documents
- Impact on business goal
- Compatibility with original vision
- Approval

### System Document

- Purpose
- Responsibilities
- Non-responsibilities
- Inputs
- Outputs
- Dependencies
- Upstream traceability
- Downstream artifacts
- Validation criteria
- Open questions

### Subsystem Document

- Purpose
- Parent system
- Responsibilities
- Interfaces
- Dependencies
- Data ownership
- Failure modes
- Validation criteria

### Feature Document

- User or system need
- Goal impact
- Scope
- Non-goals
- Acceptance criteria
- Dependencies
- Validation strategy

### Task Document

- Objective
- Upstream links
- Goal impact
- Project invariant impact
- Sensitive-data classification
- Contract/schema impact
- Replay/determinism impact
- Scope
- Non-goals
- Acceptance criteria
- Required context
- Validation task
- Required gates

### Execution Plan

- Metadata
- Upstream traceability
- Goal impact
- Project invariants
- Sensitive-data handling
- Contract validation plan
- Replay/determinism plan
- Scope
- Non-goals
- Files to inspect
- Files to create
- Files to modify
- Files that must not be modified
- Implementation steps
- Test plan
- Validation plan
- Gate commands
- Documentation updates
- Rollback plan
- Agent handoff prompt
- Completion checklist

### Coding Prompt

- Task summary
- Execution plan link
- Required context
- Allowed changes
- Forbidden changes
- Implementation instructions
- Acceptance criteria
- Validation commands
- Expected output

### Validation Report

- Artifact validated
- Validation scope
- Evidence
- Gate evidence
- Invariant evidence
- Sensitive-data scan evidence
- Replay and determinism evidence when applicable
- Passed criteria
- Failed criteria
- Deviations
- Recommendation

### Semantic Compression Document

- Source document
- Compression level
- Preserved intent
- Preserved constraints
- Critical links
- Conditions for reading full document

## Output requirements for audit tools

Audit tools should produce:

1. Missing documents
2. Missing required sections
3. Empty required sections
4. Documents with unknown upstream traceability
5. Documents with no goal impact
6. Suggested remediation text
