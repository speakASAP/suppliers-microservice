#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const defaultReport = 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md';
const defaultManifest = path.join(process.env.RUNTIME_EVIDENCE_DIR || '/tmp/stock-traceability-runtime', 'stock-traceability-runtime-evidence-manifest.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function readTextIfExists(filePath) {
  return filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function reportLooksComplete(report) {
  return report.includes('- status: passed-runtime')
    && report.includes('- completeness_level: runtime-complete')
    && report.includes('Runtime complete')
    && !report.includes('missing-runtime')
    && !report.includes('pending-runtime')
    && !report.includes('Runtime incomplete');
}

function verifyCompletion({ reportFile, manifestFile }) {
  const explicitReportPath = reportFile || process.env.RUNTIME_EVIDENCE_REPORT || "";
  const reportPath = explicitReportPath || defaultReport;
  if (!fs.existsSync(reportPath)) {
    return { status: 'incomplete', reason: 'runtime report is absent', reportFile: reportPath };
  }

  const report = readTextIfExists(reportPath);
  if (!reportLooksComplete(report)) {
    return { status: 'incomplete', reason: 'runtime report is not passed-runtime/runtime-complete', reportFile: reportPath };
  }

  const manifestPath = manifestFile || process.env.RUNTIME_EVIDENCE_MANIFEST || (!explicitReportPath && fs.existsSync(defaultManifest) ? defaultManifest : "");
  if (!manifestPath) {
    return {
      status: "incomplete",
      reason: "runtime report claims completion but no runtime evidence manifest was provided",
      reportFile: reportPath,
    };
  }

  try {
    runNodeJson(["reports/validation/verify-runtime-evidence-report.js"], { RUNTIME_EVIDENCE_REPORT: reportPath });
    const bundle = runNodeJson(["reports/validation/verify-runtime-evidence-bundle.js", manifestPath, reportPath]);
    return {
      status: "complete",
      reportFile: reportPath,
      manifestFile: manifestPath,
      bundleStatus: bundle.status,
    };
  } catch (error) {
    return {
      status: "incomplete",
      reason: `runtime report claims completion but verified bundle is missing, stale, or invalid: ${error.message}`,
      reportFile: reportPath,
      manifestFile: manifestPath,
    };
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function initSelfTestRepo(root, repo) {
  const repoPath = path.join(root, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# ' + repo + '\n');
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.email=codex@example.invalid', '-c', 'user.name=Codex', 'commit', '-m', 'self-test repo'], { cwd: repoPath, stdio: 'pipe' });
  return repoPath;
}

function selfTestHead(root, repo) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.join(root, repo), encoding: 'utf8' }).trim();
}

function runSelfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-completion-verify-'));
  const incompleteReport = path.join(dir, 'incomplete.md');
  fs.writeFileSync(incompleteReport, '# runtime\n- status: failed-runtime\n- completeness_level: partial\nRuntime incomplete\n');
  const incomplete = verifyCompletion({ reportFile: incompleteReport });
  assert(incomplete.status === 'incomplete', 'completion verifier must treat failed-runtime report as incomplete');

  const passedReportWithoutManifest = path.join(dir, 'passed-no-manifest.md');
  fs.writeFileSync(passedReportWithoutManifest, '# runtime\n- status: passed-runtime\n- completeness_level: runtime-complete\nRuntime complete\n');
  const missingManifest = verifyCompletion({ reportFile: passedReportWithoutManifest });
  assert(missingManifest.status === "incomplete", "completion verifier must treat passed-runtime report without manifest path as incomplete");
  assert(/manifest/.test(missingManifest.reason), "completion verifier must explain missing manifest path");

  const selfTestRoot = path.join(dir, 'repos');
  for (const repo of ['warehouse-microservice', 'catalog-microservice', 'suppliers-microservice']) {
    initSelfTestRepo(selfTestRoot, repo);
  }

  const bundleDir = fs.mkdtempSync(path.join(dir, 'bundle-'));
  const fixtureFile = path.join(bundleDir, 'fixture.json');
  const smokeFile = path.join(bundleDir, 'smoke.json');
  const deploymentFile = path.join(bundleDir, 'deployment.json');
  const reportFile = path.join(bundleDir, 'report.md');
  const manifestFile = path.join(bundleDir, 'manifest.json');
  const legs = [
    { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, available: 4, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
    { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', available: 3, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
    { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', available: 7, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
  ];
  const fixture = {
    status: 'fixture-ready',
    fixtureCheck: true,
    mutationEnabled: false,
    productId: 'product-synthetic',
    traceProductSkuPrefix: 'CODEX-STOCK-TRACE-',
    warehouseOrigins: [
      { warehouseId: 'warehouse-own', warehouseType: 'own', supplierId: null, available: 4 },
      { warehouseId: 'warehouse-supplier', warehouseType: 'supplier', supplierId: 'supplier-synthetic', available: 3 },
      { warehouseId: 'warehouse-dropship', warehouseType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
    ],
    logisticsRoutes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
    logisticsLegs: legs,
    supplierImport: { triggered: false, ownWarehouseId: 'warehouse-own', supplierWarehouseId: 'warehouse-supplier', dropshipWarehouseId: 'warehouse-dropship' },
  };
  const smoke = {
    status: 'passed',
    productId: 'product-synthetic',
    traceProductSkuPrefix: 'CODEX-STOCK-TRACE-',
    cleanupEvidence: 'deferred:traceability-runbook',
    health: [{ service: 'warehouse', status: 'ok' }, { service: 'catalog', status: 'ok' }, { service: 'suppliers', status: 'ok' }],
    catalogProduct: { id: 'product-synthetic', sku: 'CODEX-STOCK-TRACE-001' },
    warehouseTopology: { totals: { totalAvailable: 14 }, ownWarehouses: [{ warehouseId: 'warehouse-own', available: 4 }], supplierWarehouses: [{ warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', available: 3 }, { warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', available: 7 }] },
    warehouseOrigins: fixture.warehouseOrigins,
    supplierImport: { triggered: true, supplierId: 'supplier-synthetic', supplierWarehouseId: 'warehouse-supplier', dropshipWarehouseId: 'warehouse-dropship', sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE' },
    logisticsRoutes: fixture.logisticsRoutes,
    logisticsLegs: legs,
    catalogAvailability: { source: 'warehouse', warehouseCount: 3, logisticsOptionCount: 3, preferredRoute: 'local_fulfillment', routeTypes: fixture.logisticsRoutes, routeLegs: legs },
    coverage: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' },
    coverageAudit: { matchedProduct: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' } },
    projection: { productId: 'product-synthetic', source: 'warehouse', stockQuantity: 14, routeCount: 3, routeTypes: fixture.logisticsRoutes, routeLegs: legs },
    supplierJob: { status: 'completed', supplierId: 'supplier-synthetic', idempotencyKey: 'manual:traceability-synthetic', catalogProductValidationStatus: 'passed', catalogProductIdsChecked: ['product-synthetic'], catalogProductValidationErrorCount: 0, warehouseAuthority: 'warehouse-microservice', warehouseStockUpdateAttempted: true, warehouseStockUpdateApproved: true, updatedProducts: 1 },
    stockAuthority: { source: 'warehouse', warehouseTotalAvailable: 14, warehouseOriginAvailable: 14, catalogAvailabilityTotal: 14, catalogCoverageTotal: 14, projectionStockQuantity: 14 },
  };
  const repoByService = { warehouse: 'warehouse-microservice', catalog: 'catalog-microservice', suppliers: 'suppliers-microservice' };
  const services = Object.fromEntries(['warehouse', 'catalog', 'suppliers'].map((service) => [service, {
    commitSha: selfTestHead(selfTestRoot, repoByService[service]),
    deployCommand: './scripts/deploy.sh',
    healthEvidence: service === 'catalog' ? '/health passed' : '/api/health passed',
    protectedEndpointEvidence: 'anonymous ' + service + ' endpoint returned 401',
  }]));
  writeJson(fixtureFile, fixture);
  writeJson(smokeFile, smoke);
  writeJson(deploymentFile, {
    generatedFromCurrentHeads: true,
    completionReminder: "Deployment evidence is valid only when verify-stock-traceability-completion.js passes against the generated runtime manifest.",
    services,
  });
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: reportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  runNodeJson(['reports/validation/run-runtime-evidence-flow.js', '--manifest-self-test'], { CROSS_SERVICE_ROOT: selfTestRoot });
  const crypto = require('crypto');
  const artifact = (file) => {
    const buffer = fs.readFileSync(file);
    return { file, bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  };
  writeJson(manifestFile, {
    status: 'runtime-complete-evidence-bundle',
    generatedAt: new Date().toISOString(),
    serviceHeads: Object.fromEntries(Object.entries(services).map(([service, item]) => [service, item.commitSha])),
    artifacts: { fixture: artifact(fixtureFile), smoke: artifact(smokeFile), deployment: artifact(deploymentFile), report: artifact(reportFile) },
  });
  const previousRoot = process.env.CROSS_SERVICE_ROOT;
  process.env.CROSS_SERVICE_ROOT = selfTestRoot;
  const complete = verifyCompletion({ reportFile, manifestFile });
  if (previousRoot === undefined) {
    delete process.env.CROSS_SERVICE_ROOT;
  } else {
    process.env.CROSS_SERVICE_ROOT = previousRoot;
  }
  assert(complete.status === 'complete', 'completion verifier must accept complete verified bundle');
  return { status: "passed", incompleteStatus: incomplete.status, missingManifestStatus: missingManifest.status, completeStatus: complete.status, completeVerifiedBundleAccepted: true };
}

try {
  const result = selfTest ? runSelfTest() : verifyCompletion({ reportFile: process.env.RUNTIME_EVIDENCE_REPORT || process.argv[2], manifestFile: process.env.RUNTIME_EVIDENCE_MANIFEST || process.argv[3] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'incomplete') process.exit(2);
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
