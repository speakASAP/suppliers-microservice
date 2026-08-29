# Claude Instructions

Shared rules live here:

- Claude profile: `/home/ssf/.claude/CLAUDE.md`
- Shared ecosystem instructions: `/home/ssf/Documents/Github/CLAUDE.md`
- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# CLAUDE.md (suppliers-microservice)

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

## suppliers-microservice

**Purpose**: Automated product imports from supplier REST/XML/CSV APIs with category mapping and scheduled sync into catalog-microservice.  
**Port**: 3202  
**Domain**: https://suppliers.alfares.cz  
**Stack**: NestJS · PostgreSQL · scheduled jobs

### Key constraints
- Never push supplier data to catalog without validation — always validate before import
- Supplier credentials in `.env` only
- Import jobs must be idempotent — safe to re-run without duplicates
- Push validated data to catalog-microservice, not directly to DB

### Consumers
flipflop-service, allegro-service.

**Ops**: `curl http://suppliers-microservice:3202/health` · `kubectl logs -n statex-apps -l app=suppliers-microservice -f` · `./scripts/deploy.sh`
