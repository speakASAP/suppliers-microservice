# Project Knowledge Graph Schema

## Purpose

The project knowledge graph represents relationships between goals, documents, decisions, systems, features, tasks, execution plans, prompts, code, and validation reports.

The graph helps build precise context packages and prevents agents from relying only on semantic similarity.

## Node types

```yaml
node_types:
  Goal:
  Vision:
  VisionEvolution:
  BusinessCase:
  System:
  Subsystem:
  ArchitectureDocument:
  ADR:
  Roadmap:
  Milestone:
  Feature:
  Task:
  ExecutionPlan:
  CodingPrompt:
  ContextPackage:
  CodeArtifact:
  ValidationReport:
  SemanticSummary:
  OnboardingPackage:
```

## Edge types

```yaml
edge_types:
  derives_from:
  evolves:
  implements:
  decomposes_into:
  depends_on:
  constrained_by:
  justified_by:
  validates:
  produces:
  summarized_by:
  included_in_context:
  impacts_goal:
  executed_by:
  generates:
```

## Required relationships

Every task must have:

```text
Task -> implements -> Feature or Milestone
Task -> impacts_goal -> Goal
Task -> decomposes_into -> ExecutionPlan
```

Every execution plan must have:

```text
ExecutionPlan -> derives_from -> Task
ExecutionPlan -> generates -> CodingPrompt
ExecutionPlan -> constrained_by -> ADR or ArchitectureDocument
```

Every coding prompt must have:

```text
CodingPrompt -> derives_from -> ExecutionPlan
CodingPrompt -> included_in_context -> ContextPackage
```

Every validation report must have:

```text
ValidationReport -> validates -> Task or ExecutionPlan or Feature
```

Every semantic summary must have:

```text
SemanticSummary -> summarized_by/source relationship -> SourceDocument
```

## Graph completeness rules

The graph is incomplete if:

- A task has no goal impact edge.
- An execution plan has no source task.
- A coding prompt has no execution plan.
- A validation report does not validate a known artifact.
- An ADR is not linked to the architecture or system it constrains.
- A semantic summary has no source document.

## Context retrieval rule

When building a context package, prefer graph traversal first:

1. Start from task or execution plan.
2. Walk upstream to feature, system, goal, vision, and ADRs.
3. Walk sideways to dependencies.
4. Walk downstream only when validation or integration requires it.
5. Use summaries for background nodes and full documents for primary nodes.

Only after graph retrieval should semantic/vector search be used as a fallback.
