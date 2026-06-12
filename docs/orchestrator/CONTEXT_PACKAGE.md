# Suppliers Context Package

Read `BUSINESS.md`, `SYSTEM.md`, `README.md`, `AGENTS.md`, `TASKS.md`, `STATE.json`, `docs/IMPLEMENTATION_ORCHESTRATOR.md`, `docs/IMPLEMENTATION_STATE.md`, and `docs/orchestrator/*` before coding.

Service context: NestJS + PostgreSQL/TypeORM, port 3202. Supplier endpoints manage suppliers; import endpoints manage jobs; mapping endpoints manage supplier-to-Catalog category mappings. Consumers: flipflop-service and allegro-service. Integrations: database-server, logging-microservice, catalog-microservice, and warehouse-microservice.

Production URL is inconsistent in current docs: `BUSINESS.md` says `https://supplier.alfares.cz`; `CLAUDE.md` says `https://suppliers.alfares.cz`. Verify before health checks.

Do not copy decoded secrets, supplier credentials, private supplier endpoints, raw production supplier payloads, Catalog write payloads, Warehouse stock mutation payloads, or sensitive logs into docs or prompts.
