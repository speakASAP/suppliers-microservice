#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireSnippets(relativePath, snippets) {
  const text = read(relativePath);
  for (const snippet of snippets) {
    assert(text.includes(snippet), `${relativePath} missing required snippet: ${snippet}`);
  }
  return text;
}

const controllerText = requireSnippets("src/business-health/business-health.controller.ts", [
  '@Controller("business-health")',
  "@Public()",
  '@Get("supplier-warehouse-traceability")',
  "getSupplierWarehouseTraceabilityEnvelope",
]);

const serviceText = requireSnippets("src/business-health/business-health.service.ts", [
  'const ENDPOINT = "/api/business-health/supplier-warehouse-traceability" as const;',
  'contractId: "suppliers.supplier_warehouse_traceability_business_health.v1"',
  'businessHealthContract: "stock-order-marketplace-business-health.v1"',
  'service: "suppliers-microservice"',
  'status: "warn"',
  "mutatesSuppliers: false",
  "mutatesWarehouse: false",
  "mutatesCatalog: false",
  "mutatesMarketplace: false",
  "runtimeDataQueried: false",
  "productionDbQueried: false",
  "liveSyntheticMutationAuthorized: false",
  "src/imports/import-validation.ts",
  "src/imports/imports.service.ts",
  "src/imports/adapters/synthetic-trace-supplier-adapter.ts",
  "reports/validation/synthetic-stock-traceability-check.js",
  "reports/validation/runtime-stock-traceability-smoke.js",
  "reports/validation/verify-stock-traceability-completion.js",
  "docs/cross-service/stock-traceability-flow.md",
  "docs/orchestrator/2026-07-06-suppliers-business-health-handoff.md",
  "validation-first supplier import service",
  "Synthetic stock traceability proof demonstrates the cross-service plumbing but does not prove real supplier procurement readiness.",
  "[MISSING: real supplier display name, stable supplier code, business owner, technical owner, and escalation path]",
  "[MISSING: authentication shape and runtime credential reference key names]",
  "[MISSING: sanitized supplier payload samples for valid, empty, malformed, paginated, and supplier-error responses]",
  "[MISSING: warehouse/location mapping, dropship versus supplier-managed semantics, and Warehouse mutation approval boundary]",
  "vision:",
  "goalImpact:",
  "system:",
  "feature:",
  "task:",
  "executionPlan:",
  "codingPrompt:",
  "code:",
  "validation:",
]);

requireSnippets("src/business-health/business-health.types.ts", [
  "SupplierWarehouseTraceabilityEvidenceEnvelope",
  '"suppliers.supplier_warehouse_traceability_business_health.v1"',
  '"/api/business-health/supplier-warehouse-traceability"',
  "mutatesSuppliers: false",
  "mutatesWarehouse: false",
  "mutatesCatalog: false",
  "mutatesMarketplace: false",
  "runtimeDataQueried: false",
  "productionDbQueried: false",
  "liveSyntheticMutationAuthorized: false",
]);

requireSnippets("src/business-health/business-health.module.ts", [
  "BusinessHealthController",
  "BusinessHealthService",
  "export class BusinessHealthModule",
]);

requireSnippets("src/app.module.ts", [
  "BusinessHealthModule",
  "./business-health/business-health.module",
]);

requireSnippets("package.json", [
  "verify:business-health-suppliers-traceability-contract",
  "scripts/verify-business-health-suppliers-traceability-contract.js",
]);

const handoffText = requireSnippets("docs/orchestrator/2026-07-06-suppliers-business-health-handoff.md", [
  "GET /api/business-health/supplier-warehouse-traceability",
  "suppliers.supplier_warehouse_traceability_business_health.v1",
  "Business-health endpoint implementation",
  "runtimeDataQueried: false",
  "productionDbQueried: false",
  "liveSyntheticMutationAuthorized: false",
  "npm run verify:business-health-suppliers-traceability-contract",
]);

const requiredExistingRefs = [
  "src/imports/import-validation.ts",
  "src/imports/imports.service.ts",
  "src/imports/adapters/synthetic-trace-supplier-adapter.ts",
  "reports/validation/synthetic-stock-traceability-check.js",
  "reports/validation/runtime-stock-traceability-smoke.js",
  "reports/validation/verify-stock-traceability-completion.js",
  "docs/cross-service/stock-traceability-flow.md",
  "docs/orchestrator/2026-07-06-suppliers-business-health-handoff.md",
];

for (const relativePath of requiredExistingRefs) {
  assert(fs.existsSync(path.join(root, relativePath)), `referenced source/evidence file missing: ${relativePath}`);
  assert(serviceText.includes(relativePath), `service sourceRefs missing ${relativePath}`);
}

const endpointSource = [
  ["src/business-health/business-health.controller.ts", controllerText],
  ["src/business-health/business-health.service.ts", serviceText],
  ["src/business-health/business-health.types.ts", read("src/business-health/business-health.types.ts")],
  ["src/business-health/business-health.module.ts", read("src/business-health/business-health.module.ts")],
].map(([file, text]) => ({ file, text }));

const forbiddenEndpointPatterns = [
  [/\bInjectRepository\b/, "Repository injection"],
  [/\bRepository\s*</, "TypeORM repository"],
  [/\bTypeOrmModule\b/, "TypeORM module"],
  [/\bQueryBuilder\b/i, "TypeORM query builder"],
  [/\bfindOne\b|\bfind\b|\bsave\b|\bupdate\b|\bdelete\b/, "repository-style query/mutation"],
  [/\bHttpService\b/, "HttpService"],
  [/\bfetch\s*\(/, "fetch"],
  [/\baxios\b/, "axios"],
  [/\bxml2js\b/, "xml2js"],
  [/\bprocess\.env\b/, "process.env"],
  [/\brunImport\b|\bcreateOrReuseJob\b|\bfetchNormalizedItems\b/, "import execution"],
  [/\bsupplier-reconciliations\b|\bwarehouse.*post\b|\bcatalog.*post\b/i, "Warehouse/Catalog mutation call"],
  [/Authorization:\s*Bearer/i, "bearer token"],
  [/api[_-]?key\s*[:=]/i, "API key"],
  [/password\s*[:=]/i, "password"],
  [/BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY/i, "private key"],
  [/rawSupplierPayload\s*[:=]/i, "raw supplier payload value"],
];

for (const { file, text } of endpointSource) {
  for (const [pattern, label] of forbiddenEndpointPatterns) {
    assert(!pattern.test(text), `${file} contains forbidden business-health endpoint pattern: ${label}`);
  }
}

const missingMarkers = handoffText.match(/\[MISSING: [^\]]+\]/g) || [];
assert(missingMarkers.length >= 10, "handoff must preserve at least 10 [MISSING: ...] blockers");

console.log(JSON.stringify({
  status: "passed",
  endpoint: "/api/business-health/supplier-warehouse-traceability",
  contractId: "suppliers.supplier_warehouse_traceability_business_health.v1",
  checkedSourceRefs: requiredExistingRefs.length,
  forbiddenEndpointPatternsChecked: forbiddenEndpointPatterns.length,
  missingMarkers: missingMarkers.length,
}, null, 2));
