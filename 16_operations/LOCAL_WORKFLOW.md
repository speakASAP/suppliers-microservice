# Local and Remote Workflow

```yaml
id: LOCAL-WORKFLOW
status: draft
owner: supplier-service-owner
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - ../AGENTS.md
  - ../06_architecture/ARCHITECTURE_OVERVIEW.md
downstream: []
related_adrs: []
```

## Remote Repository

Use the `alfares` SSH alias and the remote path:

```bash
ssh alfares
cd /home/ssf/Documents/Github/suppliers-microservice
```

For one-off commands, use `ssh alfares` with the repository path.

## Build

```bash
npm run build
```

## Deploy

```bash
./scripts/deploy.sh
```

## Documentation Gates

```bash
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
python3 scripts/pre_coding_gate.py --root .
python3 scripts/deployment_readiness_gate.py --root .
```

## Change Note

- 2026-06-12: Initial workflow document created.
