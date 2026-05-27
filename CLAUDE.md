# CLAUDE.md (suppliers-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

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
