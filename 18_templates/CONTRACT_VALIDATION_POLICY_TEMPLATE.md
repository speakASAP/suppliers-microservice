# Contract Validation Policy

## Validation scope

[MISSING: list schemas, examples, API contracts, event contracts or document formats governed by this policy]

## Required validation before coding

- Every machine-readable contract must parse.
- Every schema must be validated by the declared schema standard or validator.
- Every example must validate against its matching contract.
- Examples must be synthetic or masked and comply with `../23_documentation_contracts/SENSITIVE_DATA_POLICY.md`.
- Contract validation must run locally before runtime implementation work begins.

## Matching convention

[MISSING: define how schemas/contracts map to examples and fixtures]

## Failure policy

Any contract validation failure blocks coding or deployment for the affected artifact. Do not weaken contracts only to make examples pass unless the semantic contract remains aligned with approved upstream intent.

## Validation command

```bash
[MISSING: local command]
```

## Report output

[MISSING: report paths or evidence format]
