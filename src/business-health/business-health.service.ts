import { Injectable } from "@nestjs/common";
import { SupplierWarehouseTraceabilityEvidenceEnvelope } from "./business-health.types";

const ENDPOINT = "/api/business-health/supplier-warehouse-traceability" as const;

@Injectable()
export class BusinessHealthService {
  getSupplierWarehouseTraceabilityEnvelope(): SupplierWarehouseTraceabilityEvidenceEnvelope {
    return {
      contractId: "suppliers.supplier_warehouse_traceability_business_health.v1",
      businessHealthContract: "stock-order-marketplace-business-health.v1",
      service: "suppliers-microservice",
      endpoint: ENDPOINT,
      status: "warn",
      generatedAt: new Date().toISOString(),
      evidenceKind: "supplier-to-warehouse-traceability",
      mutatesSuppliers: false,
      mutatesWarehouse: false,
      mutatesCatalog: false,
      mutatesMarketplace: false,
      runtimeDataQueried: false,
      productionDbQueried: false,
      liveSyntheticMutationAuthorized: false,
      sourceRefs: [
        "src/imports/import-validation.ts",
        "src/imports/imports.service.ts",
        "src/imports/adapters/synthetic-trace-supplier-adapter.ts",
        "reports/validation/synthetic-stock-traceability-check.js",
        "reports/validation/runtime-stock-traceability-smoke.js",
        "reports/validation/verify-stock-traceability-completion.js",
        "docs/cross-service/stock-traceability-flow.md",
        "docs/orchestrator/2026-07-06-suppliers-business-health-handoff.md",
      ],
      assertions: [
        "Suppliers validates supplier stock candidates before downstream writes.",
        "Warehouse remains the stock authority; Suppliers may only orchestrate owner-approved reconciliation intent.",
        "Supplier import jobs use idempotency keys and source fingerprints before replay-sensitive work.",
        "Synthetic stock traceability proof demonstrates the cross-service plumbing but does not prove real supplier procurement readiness.",
        "Business-health evidence must not expose secrets, raw supplier payloads, private supplier endpoints, bearer tokens, API keys, passwords, or private keys.",
        "No live supplier endpoint, production database, Warehouse API, Catalog API, marketplace API, import execution, or mutation is called by this endpoint.",
      ],
      blockers: [
        "[MISSING: real supplier display name, stable supplier code, business owner, technical owner, and escalation path]",
        "[MISSING: active supplier row or approved onboarding mutation path with exact non-secret metadata]",
        "[MISSING: private endpoint value or approved runtime endpoint reference plan outside committed docs]",
        "[MISSING: authentication shape and runtime credential reference key names]",
        "[MISSING: secret creation, rotation, storage, and deployment owner]",
        "[MISSING: sanitized supplier payload samples for valid, empty, malformed, paginated, and supplier-error responses]",
        "[MISSING: product identity mapping, Catalog category mapping prerequisites, and Catalog write constraints]",
        "[MISSING: warehouse/location mapping, dropship versus supplier-managed semantics, and Warehouse mutation approval boundary]",
        "[MISSING: owner validation evidence and explicit approval for any runtime import, deployment, Catalog write, or Warehouse mutation]",
      ],
      forbiddenEvidence: [
        "Repository injection",
        "TypeORM query",
        "outbound HTTP client call",
        "runtime environment reads inside the business-health endpoint service",
        "supplier import execution",
        "Warehouse or Catalog mutation call",
        "credential values or raw supplier payloads",
      ],
      intentPreservation: {
        vision: "Suppliers remains the controlled validation-first supplier import service for product and stock intake.",
        goalImpact: "Business health can distinguish synthetic traceability proof from blocked real supplier procurement readiness.",
        system: "Suppliers validates and orchestrates supplier candidates; Warehouse owns stock truth; Catalog owns product truth and projection; marketplaces consume projected truth.",
        feature: "Suppliers-owned read-only supplier-to-Warehouse traceability evidence envelope.",
        task: "Expose a source-only contract endpoint for business-health aggregation.",
        executionPlan: "Add a narrow public endpoint, static envelope, handoff markers, and verifier without runtime reads, imports, deploys, or mutations.",
        codingPrompt: "Return sanitized source evidence and preserve all [MISSING: ...] runtime procurement blockers.",
        code: "src/business-health/** wired through src/app.module.ts.",
        validation: "npm run verify:business-health-suppliers-traceability-contract, node scripts/verify-business-health-suppliers-contract.js, npm run build, git diff --check.",
      },
    };
  }
}
