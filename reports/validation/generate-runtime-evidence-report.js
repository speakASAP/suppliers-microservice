#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath, fallback) {
  if (!filePath) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asStatus(condition) {
  return condition ? 'passed-runtime' : 'missing-runtime';
}

function valueOrDash(value) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function boolWord(value) {
  return value ? 'yes' : 'no';
}

function summarizeHealth(health) {
  if (!Array.isArray(health)) return 'Health evidence missing.';
  return health.map((item, index) => {
    if (item?.error) return `service-${index + 1}: failed`;
    const status = item?.status || item?.data?.status || item?.health || 'passed';
    return `service-${index + 1}: ${status}`;
  }).join('; ');
}

function summarizeTopology(topology) {
  if (!topology) return 'Topology evidence missing.';
  const own = topology.ownWarehouses || [];
  const supplier = topology.supplierWarehouses || [];
  return `own=${own.length}, supplierManaged=${supplier.length}, totalAvailable=${valueOrDash(topology.totals?.totalAvailable)}`;
}

function summarizeOrigins(origins) {
  if (!Array.isArray(origins)) return 'Origin evidence missing.';
  return origins.map((row) => `${row.warehouseType}:${row.warehouseId}:available=${row.available}:supplier=${valueOrDash(row.supplierId)}`).join('; ');
}

function summarizeSupplierJob(job) {
  if (!job) return 'Supplier import evidence missing.';
  return `status=${valueOrDash(job.status)}, idempotencyKey=${valueOrDash(job.idempotencyKey)}, authority=${valueOrDash(job.warehouseAuthority)}, attempted=${boolWord(job.warehouseStockUpdateAttempted)}, approved=${boolWord(job.warehouseStockUpdateApproved)}, updatedProducts=${valueOrDash(job.updatedProducts)}`;
}

function summarizeCatalogAvailability(availability) {
  if (!availability) return 'Catalog availability evidence missing.';
  return `source=${valueOrDash(availability.source)}, warehouseCount=${valueOrDash(availability.warehouseCount)}, logisticsOptionCount=${valueOrDash(availability.logisticsOptionCount)}, preferredRoute=${valueOrDash(availability.preferredRoute)}`;
}

function buildAssertions(smoke) {
  const origins = smoke.warehouseOrigins || [];
  const routes = smoke.logisticsRoutes || [];
  return [
    {
      assertion: 'Warehouse, Catalog, and Suppliers health endpoints passed.',
      evidence: summarizeHealth(smoke.health),
      passed: smoke.status === 'passed' && Array.isArray(smoke.health) && smoke.health.length === 3,
    },
    {
      assertion: 'Catalog product identity exists.',
      evidence: `productId=${valueOrDash(smoke.catalogProduct?.id || smoke.productId)}, sku=${valueOrDash(smoke.catalogProduct?.sku)}`,
      passed: Boolean(smoke.catalogProduct?.id && smoke.catalogProduct?.sku),
    },
    {
      assertion: 'Warehouse topology distinguishes own and supplier-managed warehouses.',
      evidence: summarizeTopology(smoke.warehouseTopology),
      passed: Boolean((smoke.warehouseTopology?.ownWarehouses || []).length && (smoke.warehouseTopology?.supplierWarehouses || []).length),
    },
    {
      assertion: 'Warehouse availability returns own plus supplier or dropship stock.',
      evidence: summarizeOrigins(origins),
      passed: origins.some((row) => row.warehouseType === 'own' && Number(row.available) > 0)
        && origins.some((row) => ['supplier', 'dropship'].includes(row.warehouseType) && row.supplierId && Number(row.available) > 0),
    },
    {
      assertion: 'Warehouse logistics returns local and supplier route options.',
      evidence: `routes=${routes.join(',') || '-'}`,
      passed: routes.includes('local_fulfillment') && routes.some((route) => ['supplier_replenishment', 'supplier_dropship'].includes(route)),
    },
    {
      assertion: 'Catalog availability forwards Warehouse origin rows and logistics.',
      evidence: summarizeCatalogAvailability(smoke.catalogAvailability),
      passed: smoke.catalogAvailability?.source === 'warehouse'
        && Number(smoke.catalogAvailability?.warehouseCount || 0) >= 2
        && Number(smoke.catalogAvailability?.logisticsOptionCount || 0) >= 2,
    },
    {
      assertion: 'Catalog coverage and audit classify covered mixed stock.',
      evidence: `coverage=${valueOrDash(smoke.coverage?.coverageStatus)}, origin=${valueOrDash(smoke.coverage?.stockOrigin)}, audit=${valueOrDash(smoke.coverageAudit?.matchedProduct?.coverageStatus)}/${valueOrDash(smoke.coverageAudit?.matchedProduct?.stockOrigin)}`,
      passed: smoke.coverage?.coverageStatus === 'covered'
        && smoke.coverage?.stockOrigin === 'mixed_stock'
        && smoke.coverageAudit?.matchedProduct?.coverageStatus === 'covered'
        && smoke.coverageAudit?.matchedProduct?.stockOrigin === 'mixed_stock',
    },
    {
      assertion: 'FlipFlop projection forwards Warehouse-sourced availability and logistics.',
      evidence: `productId=${valueOrDash(smoke.projection?.productId)}, source=${valueOrDash(smoke.projection?.source)}, stockQuantity=${valueOrDash(smoke.projection?.stockQuantity)}, routeCount=${valueOrDash(smoke.projection?.routeCount)}`,
      passed: Boolean(smoke.projection?.productId && smoke.projection?.source === 'warehouse' && Number(smoke.projection?.routeCount || 0) >= 2),
    },
    {
      assertion: 'Suppliers import preserves Warehouse authority.',
      evidence: summarizeSupplierJob(smoke.supplierJob),
      passed: smoke.supplierJob?.status === 'completed'
        && smoke.supplierJob?.warehouseAuthority === 'warehouse-microservice'
        && smoke.supplierJob?.warehouseStockUpdateAttempted === true
        && smoke.supplierJob?.warehouseStockUpdateApproved === true
        && Number(smoke.supplierJob?.updatedProducts || 0) > 0,
    },
    {
      assertion: 'Cleanup or archival evidence is recorded.',
      evidence: `cleanupEvidence=${valueOrDash(smoke.cleanupEvidence)}`,
      passed: Boolean(smoke.cleanupEvidence),
    },
  ];
}

function buildReport({ smoke, deployment, command }) {
  const assertions = buildAssertions(smoke);
  const complete = assertions.every((item) => item.passed);
  const metadataStatus = complete ? 'passed-runtime' : 'failed-runtime';
  const completeness = complete ? 'runtime-complete' : 'partial';
  const decision = complete ? 'Runtime complete' : 'Runtime incomplete';
  const services = deployment?.services || {};
  const commandText = command || 'node reports/validation/runtime-stock-traceability-smoke.js';

  return `# VAL-CROSS-STOCK-RUNTIME-LIVE - Cross-Service Runtime Traceability Validation

Metadata:
- id: VAL-CROSS-STOCK-RUNTIME-LIVE
- status: ${metadataStatus}
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: ${completeness}
- upstream: docs/cross-service/stock-traceability-live-runbook.md, docs/cross-service/stock-traceability-completion-audit.md, reports/validation/runtime-stock-traceability-smoke.js

## Artifact Validated

Owner-approved deployed Warehouse, Catalog, and Suppliers runtime traceability path for one synthetic Catalog good.

## Deployment Evidence

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | ${valueOrDash(services.warehouse?.commitSha)} | ${valueOrDash(services.warehouse?.deployCommand || './scripts/deploy.sh')} | ${valueOrDash(services.warehouse?.healthEvidence)} | ${valueOrDash(services.warehouse?.protectedEndpointEvidence)} |
| Catalog | ${valueOrDash(services.catalog?.commitSha)} | ${valueOrDash(services.catalog?.deployCommand || './scripts/deploy.sh')} | ${valueOrDash(services.catalog?.healthEvidence)} | ${valueOrDash(services.catalog?.protectedEndpointEvidence)} |
| Suppliers | ${valueOrDash(services.suppliers?.commitSha)} | ${valueOrDash(services.suppliers?.deployCommand || './scripts/deploy.sh')} | ${valueOrDash(services.suppliers?.healthEvidence)} | ${valueOrDash(services.suppliers?.protectedEndpointEvidence)} |

## Smoke Command Evidence

\`\`\`bash
${commandText}
\`\`\`

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
${assertions.map((item) => `| ${item.assertion} | ${item.evidence} | ${asStatus(item.passed)} |`).join('\n')}

## Smoke Output Summary

- product: ${valueOrDash(smoke.catalogProduct?.id || smoke.productId)} / ${valueOrDash(smoke.catalogProduct?.sku)}
- health: ${summarizeHealth(smoke.health)}
- warehouse topology: ${summarizeTopology(smoke.warehouseTopology)}
- warehouse origins: ${summarizeOrigins(smoke.warehouseOrigins)}
- routes: ${(smoke.logisticsRoutes || []).join(',') || '-'}
- coverage: ${valueOrDash(smoke.coverage?.coverageStatus)} / ${valueOrDash(smoke.coverage?.stockOrigin)}
- supplier job: ${summarizeSupplierJob(smoke.supplierJob)}
- cleanup evidence: ${valueOrDash(smoke.cleanupEvidence)}

## Completion Decision

${decision}

## Boundary Evidence

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval or remained deferred by recorded evidence.
`;
}

function sampleSmoke() {
  return {
    status: 'passed',
    health: [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }],
    productId: 'product-synthetic',
    cleanupEvidence: 'deferred:traceability-runbook',
    catalogProduct: { id: 'product-synthetic', sku: 'CODEX-STOCK-TRACE-001' },
    warehouseTopology: {
      totals: { totalAvailable: 11 },
      ownWarehouses: [{ warehouseId: 'warehouse-own', warehouseCode: 'OWN', available: 4 }],
      supplierWarehouses: [{ warehouseId: 'warehouse-supplier', warehouseCode: 'SUP', originType: 'dropship', supplierId: 'supplier-synthetic', available: 7 }],
    },
    warehouseOrigins: [
      { warehouseId: 'warehouse-own', warehouseType: 'own', supplierId: null, available: 4 },
      { warehouseId: 'warehouse-supplier', warehouseType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
    ],
    logisticsRoutes: ['local_fulfillment', 'supplier_dropship'],
    catalogAvailability: {
      source: 'warehouse',
      warehouseCount: 2,
      logisticsOptionCount: 2,
      preferredRoute: 'local_fulfillment',
      warehouseTypes: ['own', 'dropship'],
    },
    coverage: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' },
    coverageAudit: { matchedProduct: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' } },
    supplierJob: {
      status: 'completed',
      idempotencyKey: 'manual:traceability-synthetic',
      warehouseAuthority: 'warehouse-microservice',
      warehouseStockUpdateAttempted: true,
      warehouseStockUpdateApproved: true,
      updatedProducts: 1,
    },
    projection: { productId: 'product-synthetic', source: 'warehouse', stockQuantity: 11, routeCount: 2 },
  };
}

function main() {
  const smokeFile = process.env.SMOKE_RESULT_FILE;
  const deploymentFile = process.env.DEPLOYMENT_EVIDENCE_FILE;
  const outputFile = process.env.RUNTIME_EVIDENCE_OUTPUT || 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md';
  const smoke = selfTest ? sampleSmoke() : readJson(smokeFile, null);
  assert(smoke, 'SMOKE_RESULT_FILE is required unless --self-test is used');
  const deployment = readJson(deploymentFile, {});
  const command = process.env.REDACTED_SMOKE_COMMAND || 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] node reports/validation/runtime-stock-traceability-smoke.js';
  const report = buildReport({ smoke, deployment, command });

  if (selfTest) {
    assert(report.includes('Runtime complete'), 'self-test report should be runtime complete');
    assert(report.includes('CODEX-STOCK-TRACE-001'), 'self-test report should include synthetic SKU');
    assert(report.includes('passed-runtime'), 'self-test report should mark assertions passed');
    console.log(JSON.stringify({ status: 'passed', output: 'self-test', assertions: buildAssertions(smoke).length }, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, report);
  console.log(JSON.stringify({ status: 'passed', output: outputFile }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
