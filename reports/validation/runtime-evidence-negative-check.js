#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  return filePath;
}

function baseSmoke() {
  return {
    status: 'passed',
    health: [
      { service: 'warehouse', status: 'ok' },
      { service: 'catalog', status: 'ok' },
      { service: 'suppliers', status: 'ok' },
    ],
    productId: 'product-synthetic',
    traceProductSkuPrefix: 'CODEX-STOCK-TRACE-',
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
    stockAuthority: {
      source: 'warehouse',
      warehouseTotalAvailable: 11,
      warehouseOriginAvailable: 11,
      catalogAvailabilityTotal: 11,
      catalogCoverageTotal: 11,
      projectionStockQuantity: 11,
    },
    catalogAvailability: {
      source: 'warehouse',
      warehouseCount: 2,
      logisticsOptionCount: 2,
      preferredRoute: 'local_fulfillment',
      routeTypes: ['local_fulfillment', 'supplier_dropship'],
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
    projection: {
      productId: 'product-synthetic',
      source: 'warehouse',
      stockQuantity: 11,
      routeCount: 2,
      routeTypes: ['local_fulfillment', 'supplier_dropship'],
    },
  };
}

function deploymentEvidence() {
  return {
    services: {
      warehouse: {
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous topology returned 401',
      },
      catalog: {
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/health passed',
        protectedEndpointEvidence: 'anonymous coverage returned 401',
      },
      suppliers: {
        commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous imports returned 401',
      },
    },
  };
}

function generateReport(dir, smoke) {
  const smokeFile = writeJson(dir, 'smoke.json', smoke);
  const deploymentFile = writeJson(dir, 'deployment.json', deploymentEvidence());
  const outputFile = path.join(dir, 'report.md');
  execFileSync('node', ['reports/validation/generate-runtime-evidence-report.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SMOKE_RESULT_FILE: smokeFile,
      DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
      RUNTIME_EVIDENCE_OUTPUT: outputFile,
      REDACTED_SMOKE_COMMAND: 'CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] node reports/validation/runtime-stock-traceability-smoke.js',
    },
    stdio: 'pipe',
  });
  return fs.readFileSync(outputFile, 'utf8');
}

function runVerifierExpectFailure(dir, report) {
  const reportFile = path.join(dir, 'report-to-verify.md');
  fs.writeFileSync(reportFile, report);
  try {
    execFileSync('node', ['reports/validation/verify-runtime-evidence-report.js'], {
      cwd: process.cwd(),
      env: { ...process.env, RUNTIME_EVIDENCE_REPORT: reportFile },
      stdio: 'pipe',
    });
    return false;
  } catch (_error) {
    return true;
  }
}

function runCase(name, mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `stock-trace-negative-${name}-`));
  const smoke = baseSmoke();
  mutate(smoke);
  const report = generateReport(dir, smoke);
  assert(report.includes('- status: failed-runtime'), `${name} should generate failed-runtime report`);
  assert(report.includes('Runtime incomplete'), `${name} should generate Runtime incomplete decision`);
  assert(runVerifierExpectFailure(dir, report), `${name} report should fail runtime verifier`);
  return name;
}

function runDeploymentCase(name, mutateDeployment) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `stock-trace-negative-${name}-`));
  const smoke = baseSmoke();
  const deployment = deploymentEvidence();
  mutateDeployment(deployment);
  const smokeFile = writeJson(dir, 'smoke.json', smoke);
  const deploymentFile = writeJson(dir, 'deployment.json', deployment);
  const outputFile = path.join(dir, 'report.md');
  execFileSync('node', ['reports/validation/generate-runtime-evidence-report.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SMOKE_RESULT_FILE: smokeFile,
      DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
      RUNTIME_EVIDENCE_OUTPUT: outputFile,
      REDACTED_SMOKE_COMMAND: 'CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] node reports/validation/runtime-stock-traceability-smoke.js',
    },
    stdio: 'pipe',
  });
  const report = fs.readFileSync(outputFile, 'utf8');
  assert(report.includes('- status: failed-runtime'), `${name} should generate failed-runtime report`);
  assert(report.includes('Runtime incomplete'), `${name} should generate Runtime incomplete decision`);
  assert(runVerifierExpectFailure(dir, report), `${name} report should fail runtime verifier`);
  return name;
}

const cases = [
  runCase('bad-sku-prefix', (smoke) => {
    smoke.catalogProduct.sku = 'REAL-SKU-001';
  }),
  runCase('unnamed-health', (smoke) => {
    smoke.health = [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }];
  }),
  runCase('missing-forwarded-supplier-route', (smoke) => {
    smoke.catalogAvailability.routeTypes = ['local_fulfillment'];
    smoke.projection.routeTypes = ['local_fulfillment'];
  }),
  runCase('mismatched-stock-authority-total', (smoke) => {
    smoke.stockAuthority.catalogCoverageTotal = 10;
  }),
  runDeploymentCase('invalid-deployment-commit-sha', (deployment) => {
    deployment.services.warehouse.commitSha = 'sha-warehouse';
  }),
  runDeploymentCase('missing-deployment-service-row', (deployment) => {
    delete deployment.services.suppliers;
  }),
  runDeploymentCase('missing-protected-endpoint-auth-evidence', (deployment) => {
    deployment.services.catalog.protectedEndpointEvidence = 'anonymous coverage returned 200';
  }),
];

console.log(JSON.stringify({ status: 'passed', cases }, null, 2));
