# Operational Gate Standard

## Purpose

Operational gates make intent preservation enforceable during delivery. They check that required documents, invariants, data-protection rules, contract validation and validation evidence exist before coding and before deployment.

## Gate types

| Gate | Timing | Blocks on |
|---|---|---|
| Pre-coding gate | Before converting a task or plan into code. | Missing task, execution plan, traceability, validation plan, project invariants or sensitive-data violations. |
| Integration-readiness gate | Before combining independently developed changes. | Failed contracts, missing replay/determinism evidence when applicable, invariant violations or incomplete test evidence. |
| Deployment-readiness gate | Before release, merge, deployment or closure. | Failed pre-coding gate, failed strict audit, missing validation report, unresolved missing markers or protected document changes. |

## Required evidence

Each gate must produce or reference evidence:

- command executed;
- repository root;
- target artifact;
- status;
- missing files;
- failed checks;
- invariant evidence;
- sensitive-data scan result;
- next action.

## Report location

Gate reports should be written under `reports/validation/` as JSON or Markdown. Reports are evidence, not source-of-truth governance documents.

## Failure policy

A failed gate blocks the next delivery phase. Do not weaken the gate to make a task pass. Fix the artifact, mark a documented exception, or split the task so the gate can evaluate it precisely.
