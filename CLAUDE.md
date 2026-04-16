# CLAUDE.md (suppliers-microservice)

Ecosystem defaults: sibling [`../CLAUDE.md`](../CLAUDE.md) and [`../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md`](../shared/docs/PROJECT_AGENT_DOCS_STANDARD.md).

Read this repo's `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json` first.

---

## suppliers-microservice

**Purpose**: Automated product imports from supplier REST/XML/CSV APIs with category mapping and scheduled sync into catalog-microservice.  
**Port**: 3202  
**Domain**: https://supplier.alfares.cz  
**Stack**: NestJS · PostgreSQL · scheduled jobs

### Key constraints
- Never push supplier data to catalog without validation — always validate before import
- Supplier credentials in `.env` only
- Import jobs must be idempotent — safe to re-run without duplicates
- Push validated data to catalog-microservice, not directly to DB

### Consumers
flipflop-service, allegro-service.

### Quick ops
```bash
curl http://suppliers-microservice:3202/health
docker compose logs -f
./scripts/deploy.sh
```
