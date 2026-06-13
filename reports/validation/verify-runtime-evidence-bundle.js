#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const crossServiceRoot = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const deploymentRepos = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath, label) {
  assert(fs.existsSync(filePath), `${label} does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function currentHeadForService(service) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: path.join(crossServiceRoot, deploymentRepos[service]),
    encoding: 'utf8',
  }).trim();
}

function fileEvidence(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function runNodeJson(commandArgs, env = {}) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${commandArgs.join(' ')} failed: ${result.stdout}${result.stderr}`.trim());
  }
  return JSON.parse(result.stdout);
}


function hasWarehouseOrigin(smoke, warehouseId, warehouseType) {
  if (!warehouseId) return true;
  return (smoke.warehouseOrigins || []).some((row) => row.warehouseId === warehouseId && row.warehouseType === warehouseType && Number(row.available) > 0);
}

function hasRouteForWarehouse(smoke, warehouseId, routeType) {
  if (!warehouseId) return true;
  return (smoke.logisticsLegs || []).some((route) => route.warehouseId === warehouseId && route.routeType === routeType && Array.isArray(route.legs) && route.legs.length > 0);
}

function verifyTraceArtifactConsistency(manifest) {
  const fixture = readJson(manifest.artifacts.fixture.file, 'fixture evidence artifact');
  const smoke = readJson(manifest.artifacts.smoke.file, 'smoke evidence artifact');
  assert(fixture.status === 'fixture-ready', 'fixture artifact must be fixture-ready');
  assert(fixture.fixtureCheck === true, 'fixture artifact must prove fixtureCheck=true');
  assert(fixture.mutationEnabled === false, 'fixture artifact must prove mutationEnabled=false');
  assert(smoke.status === 'passed', 'smoke artifact must be passed');
  assert(fixture.productId === smoke.productId, 'fixture and smoke artifacts must use the same TRACE_PRODUCT_ID');
  assert(fixture.traceProductSkuPrefix === smoke.traceProductSkuPrefix, 'fixture and smoke artifacts must use the same TRACE_PRODUCT_SKU_PREFIX');
  assert(smoke.catalogProduct?.id === smoke.productId, 'smoke catalog product id must match TRACE_PRODUCT_ID');
  assert(String(smoke.catalogProduct?.sku || '').startsWith(smoke.traceProductSkuPrefix || ''), 'smoke catalog product SKU must match trace prefix');
  const ownWarehouseId = fixture.supplierImport?.ownWarehouseId;
  const supplierWarehouseId = fixture.supplierImport?.supplierWarehouseId;
  const dropshipWarehouseId = fixture.supplierImport?.dropshipWarehouseId;
  assert(smoke.supplierImport?.supplierWarehouseId === supplierWarehouseId, 'fixture and smoke artifacts must use the same supplier replenishment warehouse');
  assert(smoke.supplierImport?.dropshipWarehouseId === dropshipWarehouseId, 'fixture and smoke artifacts must use the same dropship warehouse');
  assert(hasWarehouseOrigin(smoke, ownWarehouseId, 'own'), 'smoke artifact must include the fixture own warehouse origin');
  assert(hasWarehouseOrigin(smoke, supplierWarehouseId, 'supplier'), 'smoke artifact must include the fixture supplier warehouse origin');
  assert(hasWarehouseOrigin(smoke, dropshipWarehouseId, 'dropship'), 'smoke artifact must include the fixture dropship warehouse origin');
  assert(hasRouteForWarehouse(smoke, ownWarehouseId, 'local_fulfillment'), 'smoke artifact must include the fixture own warehouse local route');
  assert(hasRouteForWarehouse(smoke, supplierWarehouseId, 'supplier_replenishment'), 'smoke artifact must include the fixture supplier replenishment route');
  assert(hasRouteForWarehouse(smoke, dropshipWarehouseId, 'supplier_dropship'), 'smoke artifact must include the fixture dropship route');
  assert(smoke.cleanupEvidence, 'smoke artifact must include cleanup or archival evidence');
}

function verifyBundle({ manifestFile, reportFile }) {
  const manifestPath = manifestFile || process.env.RUNTIME_EVIDENCE_MANIFEST || path.join(process.env.RUNTIME_EVIDENCE_DIR || '/tmp/stock-traceability-runtime', 'stock-traceability-runtime-evidence-manifest.json');
  const manifest = readJson(manifestPath, 'runtime evidence manifest');
  const reportPath = reportFile || process.env.RUNTIME_EVIDENCE_REPORT || manifest.artifacts?.report?.file;
  assert(reportPath, 'runtime evidence report path is required');

  runNodeJson(['reports/validation/verify-runtime-evidence-manifest.js', manifestPath]);
  runNodeJson(['reports/validation/verify-runtime-evidence-report.js'], { RUNTIME_EVIDENCE_REPORT: reportPath });

  const reportResolved = path.resolve(reportPath);
  const manifestReportResolved = path.resolve(manifest.artifacts.report.file);
  assert(reportResolved === manifestReportResolved, 'runtime report path must match manifest report artifact');

  verifyTraceArtifactConsistency(manifest);
  const deployment = readJson(manifest.artifacts.deployment.file, 'deployment evidence artifact');
  const report = fs.readFileSync(reportPath, 'utf8');
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    const deploymentSha = deployment.services?.[service]?.commitSha;
    const manifestSha = manifest.serviceHeads?.[service];
    assert(deploymentSha === manifestSha, `${service} deployment evidence commit must match manifest service head`);
    assert(deploymentSha === currentHeadForService(service), `${service} deployment evidence commit must match current ${deploymentRepos[service]} HEAD`);
    assert(report.includes(deploymentSha), `${service} deployment commit must be present in runtime report`);
  }
  for (const artifact of ['fixture', 'smoke', 'deployment', 'report']) {
    assert(manifest.artifacts?.[artifact], `bundle manifest missing ${artifact} artifact`);
  }
  assert(report.includes('Runtime complete'), 'runtime report must declare Runtime complete');
  return { status: 'passed', manifestFile: manifestPath, reportFile: reportPath, services: Object.keys(deployment.services || {}).length };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sampleFixture() {
  const legs = [
    { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
    { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
    { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
  ];
  return {
    status: 'fixture-ready',
    fixtureCheck: true,
    mutationEnabled: false,
    warehouseOrigins: [
      { warehouseId: 'warehouse-own', warehouseType: 'own', supplierId: null, available: 4 },
      { warehouseId: 'warehouse-supplier', warehouseType: 'supplier', supplierId: 'supplier-synthetic', available: 3 },
      { warehouseId: 'warehouse-dropship', warehouseType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
    ],
    logisticsRoutes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
    logisticsLegs: legs,
    productId: 'product-synthetic',
    traceProductSkuPrefix: 'CODEX-STOCK-TRACE-',
    supplierImport: {
      triggered: false,
      ownWarehouseId: 'warehouse-own',
      supplierWarehouseId: 'warehouse-supplier',
      dropshipWarehouseId: 'warehouse-dropship',
    },
  };
}

function sampleSmoke() {
  const fixture = sampleFixture();
  return {
    status: 'passed',
    health: [{ service: 'warehouse', status: 'ok' }, { service: 'catalog', status: 'ok' }, { service: 'suppliers', status: 'ok' }],
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
    warehouseOrigins: fixture.warehouseOrigins,
    supplierImport: {
      triggered: true,
      supplierId: 'supplier-synthetic',
      supplierWarehouseId: 'warehouse-supplier',
      dropshipWarehouseId: 'warehouse-dropship',
      sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE',
    },
    logisticsRoutes: fixture.logisticsRoutes,
    logisticsLegs: fixture.logisticsLegs,
    catalogAvailability: {
      source: 'warehouse',
      warehouseCount: 3,
      logisticsOptionCount: 3,
      preferredRoute: 'local_fulfillment',
      routeTypes: fixture.logisticsRoutes,
      routeLegs: fixture.logisticsLegs,
    },
    coverage: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' },
    coverageAudit: { matchedProduct: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' } },
    projection: {
      productId: 'product-synthetic',
      source: 'warehouse',
      stockQuantity: 14,
      routeCount: 3,
      routeTypes: fixture.logisticsRoutes,
      routeLegs: fixture.logisticsLegs,
    },
    supplierJob: {
      status: 'completed',
      idempotencyKey: 'manual:traceability-synthetic',
      warehouseAuthority: 'warehouse-microservice',
      warehouseStockUpdateAttempted: true,
      warehouseStockUpdateApproved: true,
      updatedProducts: 1,
    },
    stockAuthority: {
      source: 'warehouse',
      warehouseTotalAvailable: 14,
      warehouseOriginAvailable: 14,
      catalogAvailabilityTotal: 14,
      catalogCoverageTotal: 14,
      projectionStockQuantity: 14,
    },
  };
}

function sampleDeployment() {
  return {
    services: Object.fromEntries(['warehouse', 'catalog', 'suppliers'].map((service) => [service, {
      commitSha: currentHeadForService(service),
      deployCommand: './scripts/deploy.sh',
      healthEvidence: service === 'catalog' ? '/health passed' : '/api/health passed',
      protectedEndpointEvidence: `anonymous ${service} endpoint returned 401`,
    }])),
  };
}

function writeManifest(filePath, files, serviceHeads) {
  const artifacts = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, { file, ...fileEvidence(file) }]));
  writeJson(filePath, {
    status: 'runtime-complete-evidence-bundle',
    generatedAt: new Date().toISOString(),
    serviceHeads,
    artifacts,
  });
}

function runSelfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-bundle-verify-'));
  const fixtureFile = path.join(dir, 'fixture.json');
  const smokeFile = path.join(dir, 'smoke.json');
  const deploymentFile = path.join(dir, 'deployment.json');
  const reportFile = path.join(dir, 'report.md');
  const manifestFile = path.join(dir, 'manifest.json');
  const deployment = sampleDeployment();
  writeJson(fixtureFile, sampleFixture());
  writeJson(smokeFile, sampleSmoke());
  writeJson(deploymentFile, deployment);
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: reportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  writeManifest(manifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, report: reportFile }, Object.fromEntries(Object.entries(deployment.services).map(([service, item]) => [service, item.commitSha])));
  const passed = verifyBundle({ manifestFile, reportFile });

  const mixedProductSmokeFile = path.join(dir, 'smoke-mixed-product.json');
  const mixedProductSmoke = sampleSmoke();
  mixedProductSmoke.productId = 'product-other';
  mixedProductSmoke.catalogProduct.id = 'product-other';
  writeJson(mixedProductSmokeFile, mixedProductSmoke);
  const mixedProductReportFile = path.join(dir, 'report-mixed-product.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: mixedProductSmokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mixedProductReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-other TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mixedProductManifestFile = path.join(dir, 'manifest-mixed-product.json');
  writeManifest(mixedProductManifestFile, { fixture: fixtureFile, smoke: mixedProductSmokeFile, deployment: deploymentFile, report: mixedProductReportFile }, Object.fromEntries(Object.entries(deployment.services).map(([service, item]) => [service, item.commitSha])));
  let mixedProductRejected = false;
  try {
    verifyBundle({ manifestFile: mixedProductManifestFile, reportFile: mixedProductReportFile });
  } catch (error) {
    mixedProductRejected = /same TRACE_PRODUCT_ID/.test(error.message);
  }
  assert(mixedProductRejected, 'bundle verifier must reject fixture and smoke artifacts for different trace products');

  const mixedWarehouseSmokeFile = path.join(dir, 'smoke-mixed-warehouse.json');
  const mixedWarehouseSmoke = sampleSmoke();
  mixedWarehouseSmoke.supplierImport.supplierWarehouseId = 'warehouse-other-supplier';
  mixedWarehouseSmoke.warehouseOrigins = mixedWarehouseSmoke.warehouseOrigins.map((row) => row.warehouseId === 'warehouse-supplier' ? { ...row, warehouseId: 'warehouse-other-supplier' } : row);
  mixedWarehouseSmoke.logisticsLegs = mixedWarehouseSmoke.logisticsLegs.map((route) => route.warehouseId === 'warehouse-supplier' ? { ...route, warehouseId: 'warehouse-other-supplier' } : route);
  mixedWarehouseSmoke.catalogAvailability.routeLegs = mixedWarehouseSmoke.logisticsLegs;
  mixedWarehouseSmoke.projection.routeLegs = mixedWarehouseSmoke.logisticsLegs;
  writeJson(mixedWarehouseSmokeFile, mixedWarehouseSmoke);
  const mixedWarehouseReportFile = path.join(dir, 'report-mixed-warehouse.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: mixedWarehouseSmokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mixedWarehouseReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-other-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mixedWarehouseManifestFile = path.join(dir, 'manifest-mixed-warehouse.json');
  writeManifest(mixedWarehouseManifestFile, { fixture: fixtureFile, smoke: mixedWarehouseSmokeFile, deployment: deploymentFile, report: mixedWarehouseReportFile }, Object.fromEntries(Object.entries(deployment.services).map(([service, item]) => [service, item.commitSha])));
  let mixedWarehouseRejected = false;
  try {
    verifyBundle({ manifestFile: mixedWarehouseManifestFile, reportFile: mixedWarehouseReportFile });
  } catch (error) {
    mixedWarehouseRejected = /same supplier replenishment warehouse/.test(error.message);
  }
  assert(mixedWarehouseRejected, 'bundle verifier must reject fixture and smoke artifacts for different supplier warehouses');

  const mismatchedDeploymentFile = path.join(dir, 'deployment-mismatched.json');
  const mismatchedDeployment = sampleDeployment();
  mismatchedDeployment.services.catalog.commitSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  writeJson(mismatchedDeploymentFile, mismatchedDeployment);
  const mismatchedManifestFile = path.join(dir, 'manifest-mismatched.json');
  writeManifest(mismatchedManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: mismatchedDeploymentFile, report: reportFile }, Object.fromEntries(Object.entries(deployment.services).map(([service, item]) => [service, item.commitSha])));
  let mismatchRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedManifestFile, reportFile });
  } catch (error) {
    mismatchRejected = /deployment evidence commit must match manifest service head/.test(error.message);
  }
  assert(mismatchRejected, 'bundle verifier must reject deployment evidence that does not match manifest heads');
  return { ...passed, mixedTraceProductRejected: true, mixedSupplierWarehouseRejected: true, deploymentManifestMismatchRejected: true };
}

try {
  const result = selfTest ? runSelfTest() : verifyBundle({ manifestFile: process.env.RUNTIME_EVIDENCE_MANIFEST || process.argv[2], reportFile: process.env.RUNTIME_EVIDENCE_REPORT || process.argv[3] });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
