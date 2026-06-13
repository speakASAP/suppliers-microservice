#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const VALID_REDACTED_SMOKE_COMMAND = 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js';
const VALID_REDACTED_FIXTURE_COMMAND = 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check';

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
      totals: { totalAvailable: 14 },
      ownWarehouses: [{ warehouseId: 'warehouse-own', warehouseCode: 'OWN', available: 4 }],
      supplierWarehouses: [
        { warehouseId: 'warehouse-supplier', warehouseCode: 'SUP', originType: 'supplier', supplierId: 'supplier-synthetic', available: 3 },
        { warehouseId: 'warehouse-dropship', warehouseCode: 'DROP', originType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
      ],
    },
    warehouseOrigins: [
      { warehouseId: 'warehouse-own', warehouseType: 'own', supplierId: null, available: 4 },
      { warehouseId: 'warehouse-supplier', warehouseType: 'supplier', supplierId: 'supplier-synthetic', available: 3 },
      { warehouseId: 'warehouse-dropship', warehouseType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
    ],
    logisticsRoutes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
    logisticsLegs: [
      { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
    ],
    stockAuthority: {
      source: 'warehouse',
      warehouseTotalAvailable: 14,
      warehouseOriginAvailable: 14,
      catalogAvailabilityTotal: 14,
      catalogCoverageTotal: 14,
      projectionStockQuantity: 14,
    },
    catalogAvailability: {
      source: 'warehouse',
      warehouseCount: 3,
      logisticsOptionCount: 3,
      preferredRoute: 'local_fulfillment',
      routeTypes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
      routeLegs: [
      { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
    ],
      warehouseTypes: ['own', 'supplier', 'dropship'],
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
      stockQuantity: 14,
      routeCount: 3,
      routeTypes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
      routeLegs: [
      { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
    ],
    },
  };
}

function baseFixtureCheck() {
  const fixture = baseSmoke();
  return {
    ...fixture,
    status: 'fixture-ready',
    fixtureCheck: true,
    mutationEnabled: false,
    supplierImport: {
      triggered: false,
      supplierId: null,
      ownWarehouseId: 'warehouse-own',
      supplierWarehouseId: 'warehouse-supplier',
      dropshipWarehouseId: 'warehouse-dropship',
      sourceFingerprint: null,
    },
    supplierJob: null,
    cleanupEvidence: null,
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

function generateReport(dir, smoke, fixture = baseFixtureCheck()) {
  const fixtureFile = writeJson(dir, 'fixture.json', fixture);
  const smokeFile = writeJson(dir, 'smoke.json', smoke);
  const deploymentFile = writeJson(dir, 'deployment.json', deploymentEvidence());
  const outputFile = path.join(dir, 'report.md');
  execFileSync('node', ['reports/validation/generate-runtime-evidence-report.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SMOKE_RESULT_FILE: smokeFile,
      FIXTURE_CHECK_RESULT_FILE: fixtureFile,
      DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
      RUNTIME_EVIDENCE_OUTPUT: outputFile,
      REDACTED_SMOKE_COMMAND: VALID_REDACTED_SMOKE_COMMAND,
      REDACTED_FIXTURE_COMMAND: VALID_REDACTED_FIXTURE_COMMAND,
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
      FIXTURE_CHECK_RESULT_FILE: writeJson(dir, 'fixture.json', baseFixtureCheck()),
      DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
      RUNTIME_EVIDENCE_OUTPUT: outputFile,
      REDACTED_SMOKE_COMMAND: VALID_REDACTED_SMOKE_COMMAND,
      REDACTED_FIXTURE_COMMAND: VALID_REDACTED_FIXTURE_COMMAND,
    },
    stdio: 'pipe',
  });
  const report = fs.readFileSync(outputFile, 'utf8');
  assert(report.includes('- status: failed-runtime'), `${name} should generate failed-runtime report`);
  assert(report.includes('Runtime incomplete'), `${name} should generate Runtime incomplete decision`);
  assert(runVerifierExpectFailure(dir, report), `${name} report should fail runtime verifier`);
  return name;
}

function runCommandEvidenceCase(name, command) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `stock-trace-negative-${name}-`));
  const smoke = baseSmoke();
  const smokeFile = writeJson(dir, 'smoke.json', smoke);
  const deploymentFile = writeJson(dir, 'deployment.json', deploymentEvidence());
  const outputFile = path.join(dir, 'report.md');
  execFileSync('node', ['reports/validation/generate-runtime-evidence-report.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SMOKE_RESULT_FILE: smokeFile,
      FIXTURE_CHECK_RESULT_FILE: writeJson(dir, 'fixture.json', baseFixtureCheck()),
      DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
      RUNTIME_EVIDENCE_OUTPUT: outputFile,
      REDACTED_SMOKE_COMMAND: command,
      REDACTED_FIXTURE_COMMAND: VALID_REDACTED_FIXTURE_COMMAND,
    },
    stdio: 'pipe',
  });
  const report = fs.readFileSync(outputFile, 'utf8');
  assert(report.includes('- status: passed-runtime'), `${name} should generate passed-runtime before verifier command checks`);
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
  runCase('missing-logistics-leg-evidence', (smoke) => {
    smoke.logisticsLegs = [];
    smoke.catalogAvailability.routeLegs = [];
    smoke.projection.routeLegs = [];
  }),
  (() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-negative-missing-fixture-check-evidence-'));
    const report = generateReport(dir, baseSmoke(), { status: 'passed', fixtureCheck: false, mutationEnabled: true });
    assert(report.includes('- status: failed-runtime'), 'missing-fixture-check-evidence should generate failed-runtime report');
    assert(runVerifierExpectFailure(dir, report), 'missing-fixture-check-evidence report should fail runtime verifier');
    return 'missing-fixture-check-evidence';
  })(),
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
  runDeploymentCase('deployment-health-evidence-placeholder', (deployment) => {
    deployment.services.suppliers.healthEvidence = 'TODO: record /api/health response after deployment';
  }),
  runCommandEvidenceCase('invalid-smoke-command-import-disabled', VALID_REDACTED_SMOKE_COMMAND.replace('TRACE_RUN_SUPPLIERS_IMPORT=true', 'TRACE_RUN_SUPPLIERS_IMPORT=false')),
];

console.log(JSON.stringify({ status: 'passed', cases }, null, 2));
