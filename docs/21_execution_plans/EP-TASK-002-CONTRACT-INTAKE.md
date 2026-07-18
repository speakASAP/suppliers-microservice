# EP-TASK-002 - Supplier Contract Intake

Metadata:
- id: EP-TASK-002-CONTRACT-INTAKE
- status: intake-ready-blocked-for-owner-input
- goal_id: TASK-002
- created: 2026-06-15
- last_updated: 2026-06-21
- completeness_level: owner-input-required

## Upstream Traceability

- TASKS.md
- STATE.json
- docs/orchestrator/GOALS.md
- docs/orchestrator/PLAN.md
- docs/IMPLEMENTATION_STATE.md
- docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md
- docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md
- docs/supplier-contracts/PRODUCTION_REST_JSON_V1.md
- docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md

## Intent Preservation Chain

- Vision: Suppliers remains the validation-first intake service for supplier product and stock feeds.
- Goal Impact: TASK-002 can proceed only after a real supplier contract is supplied and reviewed.
- System: Supplier metadata, import jobs, category mappings, validation evidence, idempotency, Catalog identity boundaries, and Warehouse stock authority remain separated.
- Feature: Supplier-specific adapter or approved generic REST/JSON onboarding.
- Task: Collect contract inputs and approval evidence without source adapter coding.
- Execution Plan: This document defines the contract-intake gate and the follow-up coding-plan requirements.
- Coding Prompt: Blocked until owner inputs are complete and non-secret.
- Code: No adapter code is authorized by this plan.
- Validation: Documentation audit, whitespace check, secret-pattern scan, and owner contract review.

## Objective

Prepare TASK-002 for owner review by making the required supplier contract questions explicit. This plan does not implement an adapter, deploy, inspect secrets, query raw supplier payloads, run production imports, write Catalog products, mutate Warehouse stock, or create cleanup mutations.

## Repo-Derived Contract Boundary

The repo now documents the TASK-002 details that can be safely derived from the current generic REST/JSON contract in `docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md`. Those details include adapter key `rest`, `apiType=rest`, HTTPS JSON GET by default, runtime credential reference behavior, accepted payload shape, required and optional normalized fields, replay key derivation, source fingerprint derivation, and synthetic validation coverage. They are sufficient for planning a generic REST onboarding only if the owner confirms the real supplier matches the contract. They are not real supplier identity, endpoint, credential, payload sample, category mapping, product mapping, warehouse mapping, pagination, rate-limit, retry, or approval facts.

## Required Owner Inputs

The owner must complete `docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md` and create a supplier contract document from `docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md` or an approved equivalent. Required inputs are:

- Supplier identity, stable supplier code, business owner, technical owner, and escalation path.
- Adapter decision: existing `apiType=rest` generic adapter or supplier-code-specific adapter.
- Endpoint/runtime source reference plan without committing private URLs.
- Authentication shape and runtime secret reference names without decoded values.
- Payload schema, item path, required fields, optional fields, null rules, units, currency, dates, and error shape.
- Product identity mapping, Catalog category mapping requirements, and Catalog ownership boundary.
- Stock quantity mapping, warehouse/location mapping, dropship/supplier-managed semantics, and Warehouse reconciliation boundary.
- Pagination, delta/full sync rules, timeout, retry, backoff, concurrency, and rate-limit policy.
- Sanitized or synthetic examples for valid, malformed, replayed, paginated, and supplier-error payloads.
- Idempotency source record rules, source fingerprint basis, deletion/discontinuation behavior, and replay expectations.
- Owner validation evidence, approval boundary, and non-production smoke requirements if any.

## Execution-Plan Questions For The Next Coding Slice

Before any adapter implementation prompt is created, answer these questions in the supplier contract and generated coding plan:

1. Which adapter key will be used for lookup: supplier code, `apiType=rest`, or another explicit key?
2. Which runtime config names provide endpoint and credential references, and which deployment process creates them?
3. Which payload fields produce normalized product candidates, normalized category mapping lookups, and normalized Warehouse stock candidates?
4. Which validation failures block the whole import versus reject individual items with sanitized evidence?
5. Which Catalog product IDs may be referenced, and what Catalog validation must pass before Warehouse mutation can be attempted?
6. Which Warehouse IDs are allowed for this supplier, and how is supplier ownership preserved on every stock candidate?
7. What idempotency key and source fingerprint fields make retries deterministic?
8. What pagination/rate-limit state must be persisted or replay-safe?
9. What synthetic fixtures prove valid import, malformed payload rejection, credential redaction, duplicate replay, missing category mapping, unknown Catalog product, unapproved Warehouse mutation, and approved Warehouse mutation with mocked downstream clients?
10. Which runtime action, if any, needs explicit owner approval after source validation?

## Scope

Allowed files for the intake slice:

- docs/supplier-contracts/TASK-002_INTAKE_CHECKLIST.md
- docs/supplier-contracts/SUPPLIER_CONTRACT_TEMPLATE.md
- docs/supplier-contracts/TASK-002_DERIVED_REST_JSON_DETAILS.md
- docs/21_execution_plans/EP-TASK-002-CONTRACT-INTAKE.md
- docs/orchestrator/GOALS.md
- docs/orchestrator/PLAN.md
- docs/orchestrator/STATUS.md
- docs/IMPLEMENTATION_STATE.md
- TASKS.md
- STATE.json

Forbidden files and systems for this slice:

- Source adapter implementation under `src/imports/adapters/`
- Runtime secrets, `.env` files, Kubernetes secrets, and decoded credentials
- Production supplier payloads, private endpoint values, real SKUs, real product IDs, and customer data
- Catalog source, Warehouse source, production imports, Catalog writes, Warehouse mutations, deployments, and cleanup mutations

## Parallel Execution

- Agent D, contract intake: completed by this plan and checklist; no source-code conflict.
- Agent A, runtime readiness: dependency-gated by clean Warehouse, Catalog, and Suppliers worktrees.
- Agent B, source preflight: can run independently and is non-mutating.
- Agent C, runtime deployment and guarded smoke: blocked until owner approval, clean-head readiness artifacts, deployment evidence, runtime credentials, and explicit mutation approval.
- Integration owner: original coordinator thread updates state after Agent A/B/D evidence is available.
- Merge order: source preflight evidence and intake docs may land before runtime readiness; runtime readiness must be regenerated after any Suppliers commit.

## Acceptance Criteria

- Checklist and execution-plan questions exist with no invented supplier details.
- All unavailable facts remain marked `[MISSING: ...]` or `[UNKNOWN: ...]`.
- No secrets, private URLs, raw production payloads, real SKUs, or real product/customer identifiers are committed.
- Adapter implementation remains blocked until owner supplies the contract and approves the generated coding prompt.
- Documentation validation and whitespace checks pass.

## Validation Commands

```bash
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
git diff --check
rg -n "Authorization: Bearer [A-Za-z0-9_./+=:-]{12,}" docs/supplier-contracts docs/orchestrator docs/intent-preservation AGENTS.md TASKS.md
rg -n "(client[_-]?secret|password|private[_-]?key|api[_-]?key)" docs/supplier-contracts docs/orchestrator docs/intent-preservation AGENTS.md TASKS.md
```

## Rollback Plan

Revert this documentation artifact and the associated orchestrator/state updates. No source code, schema, runtime config, deployment, production data, Catalog data, or Warehouse stock rollback is required.
