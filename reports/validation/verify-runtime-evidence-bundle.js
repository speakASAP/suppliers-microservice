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

function repoPathForService(service) {
  const repo = deploymentRepos[service];
  assert(repo, `Unknown deployment service: ${service}`);
  const repoPath = path.join(crossServiceRoot, repo);
  assert(fs.existsSync(repoPath), `Repository not found for ${service}: ${repoPath}`);
  return repoPath;
}

function currentHeadForService(service) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoPathForService(service),
    encoding: 'utf8',
  }).trim();
}

function assertCleanWorktreeForService(service) {
  const status = execFileSync('git', ['status', '--short'], { cwd: repoPathForService(service), encoding: 'utf8' }).trim();
  assert(!status, `${deploymentRepos[service]} worktree must be clean before runtime evidence bundle can prove completion`);
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


function hasWarehouseOrigin(smoke, warehouseId, warehouseType, supplierId) {
  if (!warehouseId) return true;
  return (smoke.warehouseOrigins || []).some((row) => row.warehouseId === warehouseId
    && row.warehouseType === warehouseType
    && Number(row.available) > 0
    && (!supplierId || row.supplierId === supplierId));
}

function hasRouteForWarehouse(routes, warehouseId, routeType, supplierId) {
  if (!warehouseId) return true;
  return (routes || []).some((route) => route.warehouseId === warehouseId
    && route.routeType === routeType
    && (!supplierId || route.supplierId === supplierId)
    && Number(route.available) > 0
    && route.canReserveFromWarehouse === true
    && Array.isArray(route.legs)
    && route.legs.length > 0);
}

function supplierIdForOrigin(artifact, warehouseId, warehouseType) {
  if (!warehouseId) return null;
  return (artifact.warehouseOrigins || []).find((row) => row.warehouseId === warehouseId && row.warehouseType === warehouseType)?.supplierId || null;
}

function assertSupplierJobPreservesCatalogAndWarehouse(smoke, supplierId) {
  const job = smoke.supplierJob;
  assert(job?.status === 'completed', 'smoke artifact supplier job must be completed');
  assert(job.supplierId === supplierId, 'smoke artifact supplier job must belong to TRACE_SUPPLIER_ID');
  assert(job.catalogProductValidationStatus === 'passed', 'smoke artifact supplier job must prove Catalog product validation passed');
  assert(Array.isArray(job.catalogProductIdsChecked) && job.catalogProductIdsChecked.includes(smoke.productId), 'smoke artifact supplier job must include checked TRACE_PRODUCT_ID');
  assert(job.sourceFingerprint === smoke.supplierImport?.sourceFingerprint, 'smoke artifact supplier job source fingerprint must match approved supplier import request');
  assert(job.warehouseAuthority === 'warehouse-microservice', 'smoke artifact supplier job must preserve Warehouse stock authority');
  assert(job.warehouseStockUpdateAttempted === true, 'smoke artifact supplier job must record Warehouse update attempted');
  assert(job.warehouseStockUpdateApproved === true, 'smoke artifact supplier job must record approved Warehouse update');
  assert(Number(job.updatedProducts || 0) > 0, 'smoke artifact supplier job must record updated products');
}

function assertApprovalArtifactMatchesManifest(manifest, approval) {
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assert(approval.serviceHeads?.[service] === manifest.serviceHeads?.[service], 'approval artifact ' + service + ' head must match manifest service head');
  }
  assert(approval.scope?.syntheticRecordsOnly === true, 'approval artifact must preserve synthetic-only runtime scope');
  assert(approval.scope?.oneGuardedSyntheticImport === true, 'approval artifact must preserve one guarded synthetic import scope');
  assert(approval.scope?.ownerApproval === 'explicit', 'approval artifact must preserve explicit owner approval scope');
  assert(approval.scope?.smokeAllowMutation === true, 'approval artifact must preserve approved smoke mutation scope');
}

function verifyRuntimeApprovalArtifact(manifest) {
  const approvalFile = manifest.artifacts?.approval?.file;
  assert(approvalFile, 'bundle manifest missing approval artifact');
  const approval = runNodeJson(['reports/validation/verify-runtime-approval-artifact.js', approvalFile]);
  assert(approval.status === 'approved', 'runtime approval artifact verifier must return approved');
  const approvalJson = readJson(approvalFile, 'runtime approval artifact');
  assertApprovalArtifactMatchesManifest(manifest, approvalJson);
  return { approvalFile, approvalJson };
}

function assertReportUsesManifestApprovalArtifact(report, approvalFile) {
  assert(report.includes('RUNTIME_APPROVAL_ARTIFACT_FILE='), 'runtime report smoke command must include RUNTIME_APPROVAL_ARTIFACT_FILE');
  assert(report.includes('RUNTIME_APPROVAL_ARTIFACT_FILE=' + approvalFile), 'runtime report smoke command approval artifact path must match manifest approval artifact');
}

function reportSection(report, heading) {
  const marker = '## ' + heading;
  const start = report.indexOf(marker);
  assert(start !== -1, 'runtime report missing section: ' + heading);
  const next = report.indexOf('\n## ', start + marker.length);
  return next === -1 ? report.slice(start) : report.slice(start, next);
}

function commandEnvValue(section, key) {
  const token = section.split(/\s+/).find((part) => part.startsWith(key + '='));
  if (!token) return null;
  return token.slice(key.length + 1).replace(/^['"]|['"]$/g, '');
}

function assertCommandEnv(section, key, expected, label) {
  if (!expected) return;
  const actual = commandEnvValue(section, key);
  assert(actual === expected, label + ' command ' + key + ' must match hashed runtime artifact evidence');
}

function deploymentRow(report, service) {
  const label = service[0].toUpperCase() + service.slice(1);
  const row = report.split('\n').find((line) => line.startsWith('| ' + label + ' |'));
  assert(row, 'runtime report deployment evidence row is missing for ' + service);
  return row;
}

function assertReportDeploymentEvidenceMatchesArtifact(report, deployment) {
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    const row = deploymentRow(report, service);
    const item = deployment.services?.[service];
    assert(item, 'deployment artifact missing ' + service + ' evidence');
    for (const value of [item.commitSha, item.deployCommand || './scripts/deploy.sh', item.healthEvidence, item.protectedEndpointEvidence]) {
      assert(row.includes(String(value || '')), 'runtime report ' + service + ' deployment row must match hashed deployment evidence artifact');
    }
  }
}

function assertReportCommandEvidenceMatchesArtifacts(report, fixture, smoke, approval) {
  const fixtureCommand = reportSection(report, 'Fixture Check Command Evidence');
  const smokeCommand = reportSection(report, 'Smoke Command Evidence');
  assertCommandEnv(fixtureCommand, 'TRACE_PRODUCT_ID', fixture.productId, 'fixture');
  assertCommandEnv(smokeCommand, 'TRACE_PRODUCT_ID', smoke.productId, 'smoke');
  assertCommandEnv(fixtureCommand, 'TRACE_PRODUCT_SKU_PREFIX', fixture.traceProductSkuPrefix, 'fixture');
  assertCommandEnv(smokeCommand, 'TRACE_PRODUCT_SKU_PREFIX', smoke.traceProductSkuPrefix, 'smoke');
  assertCommandEnv(fixtureCommand, 'TRACE_OWN_WAREHOUSE_ID', fixture.supplierImport?.ownWarehouseId, 'fixture');
  assertCommandEnv(smokeCommand, 'TRACE_OWN_WAREHOUSE_ID', fixture.supplierImport?.ownWarehouseId, 'smoke');
  assertCommandEnv(fixtureCommand, 'TRACE_SUPPLIER_WAREHOUSE_ID', fixture.supplierImport?.supplierWarehouseId, 'fixture');
  assertCommandEnv(smokeCommand, 'TRACE_SUPPLIER_WAREHOUSE_ID', smoke.supplierImport?.supplierWarehouseId, 'smoke');
  assertCommandEnv(fixtureCommand, 'TRACE_DROPSHIP_WAREHOUSE_ID', fixture.supplierImport?.dropshipWarehouseId, 'fixture');
  assertCommandEnv(smokeCommand, 'TRACE_DROPSHIP_WAREHOUSE_ID', smoke.supplierImport?.dropshipWarehouseId, 'smoke');
  assertCommandEnv(smokeCommand, 'TRACE_SUPPLIER_ID', smoke.supplierImport?.supplierId, 'smoke');
  assertCommandEnv(smokeCommand, 'TRACE_IMPORT_IDEMPOTENCY_KEY', smoke.supplierJob?.idempotencyKey, 'smoke');
  assertCommandEnv(smokeCommand, 'TRACE_CLEANUP_EVIDENCE', smoke.cleanupEvidence, 'smoke');
  const approved = approval.approvedTraceInputs || {};
  for (const key of ['TRACE_PRODUCT_ID', 'TRACE_PRODUCT_SKU_PREFIX', 'TRACE_SUPPLIER_ID', 'TRACE_OWN_WAREHOUSE_ID', 'TRACE_SUPPLIER_WAREHOUSE_ID', 'TRACE_DROPSHIP_WAREHOUSE_ID', 'TRACE_IMPORT_IDEMPOTENCY_KEY', 'TRACE_SUPPLIER_STOCK_QTY', 'TRACE_SUPPLIER_SKU', 'TRACE_CLEANUP_EVIDENCE']) {
    assertCommandEnv(smokeCommand, key, approved[key], 'approved smoke');
  }
}

function isCompletedEvidenceText(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/TODO|placeholder/i.test(value);
}

function assertStockAuthorityMatchesTrace(smoke) {
  const authority = smoke.stockAuthority;
  assert(authority?.source === 'warehouse', 'smoke artifact stock authority must prove Warehouse source');
  const warehouseOriginTotal = (smoke.warehouseOrigins || []).reduce((sum, row) => sum + Number(row.available || 0), 0);
  const warehouseTotal = Number(authority.warehouseTotalAvailable);
  assert(Number.isFinite(warehouseTotal) && warehouseTotal > 0, 'smoke artifact stock authority must include positive Warehouse total availability');
  assert(Number(authority.warehouseOriginAvailable) === warehouseOriginTotal, 'smoke artifact stock authority origin total must match Warehouse origin rows');
  assert(Number(authority.warehouseOriginAvailable) === warehouseTotal, 'smoke artifact stock authority origin total must match Warehouse total');
  assert(Number(authority.catalogAvailabilityTotal) === warehouseTotal, 'smoke artifact stock authority Catalog availability total must match Warehouse total');
  assert(Number(authority.catalogCoverageTotal) === warehouseTotal, 'smoke artifact stock authority Catalog coverage total must match Warehouse total');
  assert(Number(authority.projectionStockQuantity) === warehouseTotal, 'smoke artifact stock authority FlipFlop projection total must match Warehouse total');
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
  const supplierId = smoke.supplierImport?.supplierId;
  assert(supplierId, 'smoke artifact must include TRACE_SUPPLIER_ID evidence');
  assert(smoke.supplierImport?.supplierWarehouseId === supplierWarehouseId, 'fixture and smoke artifacts must use the same supplier replenishment warehouse');
  assert(smoke.supplierImport?.dropshipWarehouseId === dropshipWarehouseId, 'fixture and smoke artifacts must use the same dropship warehouse');
  assert(supplierIdForOrigin(fixture, supplierWarehouseId, 'supplier') === supplierId, 'fixture supplier warehouse origin must belong to TRACE_SUPPLIER_ID');
  assert(supplierIdForOrigin(fixture, dropshipWarehouseId, 'dropship') === supplierId, 'fixture dropship warehouse origin must belong to TRACE_SUPPLIER_ID');
  assert(hasWarehouseOrigin(smoke, ownWarehouseId, 'own'), 'smoke artifact must include the fixture own warehouse origin');
  assert(hasWarehouseOrigin(smoke, supplierWarehouseId, 'supplier', supplierId), 'smoke artifact must include the fixture supplier warehouse origin for TRACE_SUPPLIER_ID');
  assert(hasWarehouseOrigin(smoke, dropshipWarehouseId, 'dropship', supplierId), 'smoke artifact must include the fixture dropship warehouse origin for TRACE_SUPPLIER_ID');
  assert(hasRouteForWarehouse(smoke.logisticsLegs, ownWarehouseId, 'local_fulfillment'), 'smoke artifact must include the fixture own warehouse local route');
  assert(hasRouteForWarehouse(smoke.logisticsLegs, supplierWarehouseId, 'supplier_replenishment', supplierId), 'smoke artifact must include the fixture supplier replenishment route for TRACE_SUPPLIER_ID');
  assert(hasRouteForWarehouse(smoke.logisticsLegs, dropshipWarehouseId, 'supplier_dropship', supplierId), 'smoke artifact must include the fixture dropship route for TRACE_SUPPLIER_ID');
  assert(hasRouteForWarehouse(smoke.catalogAvailability?.routeLegs, ownWarehouseId, 'local_fulfillment'), 'smoke artifact must include the fixture own warehouse local route in Catalog availability');
  assert(hasRouteForWarehouse(smoke.catalogAvailability?.routeLegs, supplierWarehouseId, 'supplier_replenishment', supplierId), 'smoke artifact must include the fixture supplier replenishment route in Catalog availability for TRACE_SUPPLIER_ID');
  assert(hasRouteForWarehouse(smoke.catalogAvailability?.routeLegs, dropshipWarehouseId, 'supplier_dropship', supplierId), 'smoke artifact must include the fixture dropship route in Catalog availability for TRACE_SUPPLIER_ID');
  assert(hasRouteForWarehouse(smoke.projection?.routeLegs, ownWarehouseId, 'local_fulfillment'), 'smoke artifact must include the fixture own warehouse local route in FlipFlop projection');
  assert(hasRouteForWarehouse(smoke.projection?.routeLegs, supplierWarehouseId, 'supplier_replenishment', supplierId), 'smoke artifact must include the fixture supplier replenishment route in FlipFlop projection for TRACE_SUPPLIER_ID');
  assert(hasRouteForWarehouse(smoke.projection?.routeLegs, dropshipWarehouseId, 'supplier_dropship', supplierId), 'smoke artifact must include the fixture dropship route in FlipFlop projection for TRACE_SUPPLIER_ID');
  assertSupplierJobPreservesCatalogAndWarehouse(smoke, supplierId);
  assertStockAuthorityMatchesTrace(smoke);
  assert(isCompletedEvidenceText(smoke.cleanupEvidence), 'smoke artifact must include completed cleanup or archival evidence and must not contain TODO or placeholder');
  return { fixture, smoke };
}

function verifyBundle({ manifestFile, reportFile }) {
  const manifestPath = manifestFile || process.env.RUNTIME_EVIDENCE_MANIFEST || path.join(process.env.RUNTIME_EVIDENCE_DIR || '/tmp/stock-traceability-runtime', 'stock-traceability-runtime-evidence-manifest.json');
  const manifest = readJson(manifestPath, 'runtime evidence manifest');
  const reportPath = reportFile || process.env.RUNTIME_EVIDENCE_REPORT || manifest.artifacts?.report?.file;
  assert(reportPath, 'runtime evidence report path is required');

  runNodeJson(['reports/validation/verify-runtime-evidence-manifest.js', manifestPath]);
  runNodeJson(['reports/validation/verify-runtime-evidence-report.js'], { RUNTIME_EVIDENCE_REPORT: reportPath });
  const { approvalFile, approvalJson } = verifyRuntimeApprovalArtifact(manifest);

  const reportResolved = path.resolve(reportPath);
  const manifestReportResolved = path.resolve(manifest.artifacts.report.file);
  assert(reportResolved === manifestReportResolved, 'runtime report path must match manifest report artifact');

  const { fixture, smoke } = verifyTraceArtifactConsistency(manifest);
  const deployment = readJson(manifest.artifacts.deployment.file, 'deployment evidence artifact');
  assert(deployment?.generatedFromCurrentHeads === true, 'deployment evidence artifact must be generated from current service heads');
  assert(deployment.readinessManifest && deployment.readinessManifest.sha256 === approvalJson.readinessManifest?.sha256, 'deployment evidence readiness manifest must match approval artifact readiness manifest');
  assert(String(deployment?.completionReminder || '').includes('verify-stock-traceability-completion.js'), 'deployment evidence artifact must include completion verifier reminder');
  const report = fs.readFileSync(reportPath, 'utf8');
  assertReportUsesManifestApprovalArtifact(report, approvalFile);
  assertReportDeploymentEvidenceMatchesArtifact(report, deployment);
  assertReportCommandEvidenceMatchesArtifacts(report, fixture, smoke, approvalJson);
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    const deploymentSha = deployment.services?.[service]?.commitSha;
    const manifestSha = manifest.serviceHeads?.[service];
    assert(deploymentSha === manifestSha, `${service} deployment evidence commit must match manifest service head`);
    assert(deploymentSha === currentHeadForService(service), `${service} deployment evidence commit must match current ${deploymentRepos[service]} HEAD`);
    assertCleanWorktreeForService(service);
    assert(report.includes(deploymentSha), `${service} deployment commit must be present in runtime report`);
  }
  for (const artifact of ['fixture', 'smoke', 'deployment', 'approval', 'report']) {
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
    { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, available: 4, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
    { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', available: 3, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
    { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', available: 7, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
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
      supplierId: 'supplier-synthetic',
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
      supplierId: 'supplier-synthetic',
      idempotencyKey: 'manual:traceability-synthetic',
      sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE',
      warehouseAuthority: 'warehouse-microservice',
      warehouseStockUpdateAttempted: true,
      warehouseStockUpdateApproved: true,
      catalogProductValidationStatus: 'passed',
      catalogProductIdsChecked: ['product-synthetic'],
      catalogProductValidationErrorCount: 0,
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

function sampleDeployment(readinessManifest) {
  return {
    generatedFromCurrentHeads: true,
    readinessManifest,
    completionReminder: 'Deployment evidence is valid only when verify-stock-traceability-completion.js passes against the generated runtime manifest.',
    services: Object.fromEntries(['warehouse', 'catalog', 'suppliers'].map((service) => [service, {
      commitSha: currentHeadForService(service),
      deployCommand: './scripts/deploy.sh',
      healthEvidence: service === 'catalog' ? '/health passed' : '/api/health passed',
      protectedEndpointEvidence: `anonymous ${service} endpoint returned 401`,
    }])),
  };
}

function writeReadinessBundle(dir, serviceHeads) {
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    approvalRequest: path.join(dir, 'stock-traceability-runtime-approval-request.md'),
    deploymentTemplate: path.join(dir, 'stock-traceability-deployment-evidence.template.json'),
    handoff: path.join(dir, 'stock-traceability-runtime-handoff.md'),
    plan: path.join(dir, 'stock-traceability-runtime-plan.json'),
  };
  const heads = Object.entries(serviceHeads).map(([service, head]) => service + ':' + head).join('\n');
  fs.writeFileSync(files.approvalRequest, 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST\n' + heads + '\napprovedTraceInputs TRACE_PRODUCT_ID TRACE_SUPPLIER_ID TRACE_IMPORT_IDEMPOTENCY_KEY TRACE_SUPPLIER_STOCK_QTY TRACE_SUPPLIER_SKU TRACE_CLEANUP_EVIDENCE\n');
  fs.writeFileSync(files.deploymentTemplate, JSON.stringify({ generatedFromCurrentHeads: true, heads: serviceHeads }, null, 2) + '\n');
  fs.writeFileSync(files.handoff, 'STOCK-TRACEABILITY-RUNTIME-HANDOFF\ncreate-runtime-readiness-bundle.js\n' + heads + '\n');
  fs.writeFileSync(files.plan, JSON.stringify({ status: 'plan-only', requiredApprovedSmokeEnv: ['TRACE_SUPPLIER_ID', 'TRACE_OWN_WAREHOUSE_ID', 'TRACE_SUPPLIER_WAREHOUSE_ID', 'TRACE_DROPSHIP_WAREHOUSE_ID', 'TRACE_IMPORT_IDEMPOTENCY_KEY', 'TRACE_SUPPLIER_STOCK_QTY', 'TRACE_SUPPLIER_SKU', 'TRACE_CLEANUP_EVIDENCE', 'DEPLOYMENT_EVIDENCE_FILE', 'RUNTIME_APPROVAL_ARTIFACT_FILE'] }, null, 2) + '\n');
  const artifacts = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, { file, ...fileEvidence(file) }]));
  const manifest = {
    status: 'ready-for-owner-approval',
    generatedAt: new Date().toISOString(),
    completionGate: 'incomplete-runtime-pending',
    serviceHeads,
    artifacts,
    nextRequiredAction: 'Owner approval, deployment, completed deployment evidence, and guarded runtime smoke are still required before completion.',
  };
  const manifestFile = path.join(dir, 'stock-traceability-runtime-readiness-manifest.json');
  writeJson(manifestFile, manifest);
  return { file: manifestFile, ...fileEvidence(manifestFile), status: 'verified', serviceHeads };
}

function writeApprovalRequest(filePath, serviceHeads) {
  const heads = Object.entries(serviceHeads).map(([service, head]) => service + ':' + head).join('\n');
  fs.writeFileSync(filePath, 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST\n' + heads + '\napprovedTraceInputs TRACE_PRODUCT_ID TRACE_SUPPLIER_ID TRACE_IMPORT_IDEMPOTENCY_KEY TRACE_SUPPLIER_STOCK_QTY TRACE_SUPPLIER_SKU TRACE_CLEANUP_EVIDENCE\n');
  return { id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', file: filePath, ...fileEvidence(filePath), serviceHeads };
}

function writeApprovalArtifact(filePath, readinessManifest, serviceHeads) {
  writeJson(filePath, {
    id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL',
    status: 'approved',
    approvalRequestId: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    approvalRequest: writeApprovalRequest(path.join(path.dirname(filePath), 'stock-traceability-runtime-approval-request.md'), serviceHeads),
    approvedBy: 'owner@example.test',
    approvedAt: new Date().toISOString(),
    approvedForCurrentCleanHeads: true,
    serviceHeads,
    readinessManifest,
    approvedTraceInputs: {
      TRACE_PRODUCT_ID: 'product-synthetic',
      TRACE_PRODUCT_SKU_PREFIX: 'CODEX-STOCK-TRACE-',
      TRACE_SUPPLIER_ID: 'supplier-synthetic',
      TRACE_OWN_WAREHOUSE_ID: 'warehouse-own',
      TRACE_SUPPLIER_WAREHOUSE_ID: 'warehouse-supplier',
      TRACE_DROPSHIP_WAREHOUSE_ID: 'warehouse-dropship',
      TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
      TRACE_SUPPLIER_STOCK_QTY: '7',
      TRACE_SUPPLIER_SKU: 'SUP-SKU-TRACE',
      TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    },
    scope: {
      syntheticSkuPrefix: 'CODEX-STOCK-TRACE-',
      syntheticRecordsOnly: true,
      oneGuardedSyntheticImport: true,
      runApprovedRuntimeSmoke: true,
      ownerApproval: 'explicit',
      smokeAllowMutation: true,
    },
    forbiddenActionsAcknowledged: ['real supplier imports', 'production payload ingestion', 'customer data capture', 'hard deletes', 'compensating stock changes', 'token disclosure'],
  });
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
  const approvalFile = path.join(dir, 'approval.json');
  const initialDeployment = sampleDeployment();
  const serviceHeads = Object.fromEntries(Object.entries(initialDeployment.services).map(([service, item]) => [service, item.commitSha]));
  const readinessManifest = writeReadinessBundle(path.join(dir, 'readiness'), serviceHeads);
  const deployment = sampleDeployment(readinessManifest);
  writeApprovalArtifact(approvalFile, readinessManifest, serviceHeads);
  writeJson(fixtureFile, sampleFixture());
  writeJson(smokeFile, sampleSmoke());
  writeJson(deploymentFile, deployment);
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: reportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: `WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=${approvalFile} TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js`,
  });
  writeManifest(manifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: approvalFile, report: reportFile }, serviceHeads);
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
    REDACTED_SMOKE_COMMAND: `WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-other TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=${approvalFile} TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js`,
  });
  const mixedProductManifestFile = path.join(dir, 'manifest-mixed-product.json');
  writeManifest(mixedProductManifestFile, { fixture: fixtureFile, smoke: mixedProductSmokeFile, deployment: deploymentFile, approval: approvalFile, report: mixedProductReportFile }, serviceHeads);
  let mixedProductRejected = false;
  try {
    verifyBundle({ manifestFile: mixedProductManifestFile, reportFile: mixedProductReportFile });
  } catch (error) {
    mixedProductRejected = Boolean(error.message);
  }
  assert(mixedProductRejected, 'bundle verifier must reject fixture and smoke artifacts for different trace products');

  const mixedWarehouseSmokeFile = path.join(dir, 'smoke-mixed-warehouse.json');
  const mixedWarehouseSmoke = sampleSmoke();
  mixedWarehouseSmoke.supplierImport.supplierWarehouseId = 'warehouse-other-supplier';
  mixedWarehouseSmoke.supplierImport.sourceFingerprint = 'trace:product-synthetic:warehouse-other-supplier:warehouse-dropship:7:SUP-SKU-TRACE';
  mixedWarehouseSmoke.supplierJob.sourceFingerprint = mixedWarehouseSmoke.supplierImport.sourceFingerprint;
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
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-other-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: `WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-other-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=${approvalFile} TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js`,
  });
  const mixedWarehouseManifestFile = path.join(dir, 'manifest-mixed-warehouse.json');
  writeManifest(mixedWarehouseManifestFile, { fixture: fixtureFile, smoke: mixedWarehouseSmokeFile, deployment: deploymentFile, approval: approvalFile, report: mixedWarehouseReportFile }, serviceHeads);
  let mixedWarehouseRejected = false;
  try {
    verifyBundle({ manifestFile: mixedWarehouseManifestFile, reportFile: mixedWarehouseReportFile });
  } catch (error) {
    mixedWarehouseRejected = /same supplier replenishment warehouse/.test(error.message);
  }
  assert(mixedWarehouseRejected, 'bundle verifier must reject fixture and smoke artifacts for different supplier warehouses');

  const mismatchedSupplierSmokeFile = path.join(dir, 'smoke-mismatched-supplier.json');
  const mismatchedSupplierSmoke = sampleSmoke();
  mismatchedSupplierSmoke.supplierImport.supplierId = 'supplier-other';
  mismatchedSupplierSmoke.supplierJob.supplierId = 'supplier-other';
  writeJson(mismatchedSupplierSmokeFile, mismatchedSupplierSmoke);
  const mismatchedSupplierReportFile = path.join(dir, 'report-mismatched-supplier.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: mismatchedSupplierSmokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedSupplierReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: `WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-other TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=${approvalFile} TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js`,
  });
  const mismatchedSupplierManifestFile = path.join(dir, 'manifest-mismatched-supplier.json');
  writeManifest(mismatchedSupplierManifestFile, { fixture: fixtureFile, smoke: mismatchedSupplierSmokeFile, deployment: deploymentFile, approval: approvalFile, report: mismatchedSupplierReportFile }, serviceHeads);
  let mismatchedSupplierRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedSupplierManifestFile, reportFile: mismatchedSupplierReportFile });
  } catch (error) {
    mismatchedSupplierRejected = /TRACE_SUPPLIER_ID/.test(error.message);
  }
  assert(mismatchedSupplierRejected, 'bundle verifier must reject supplier identity that does not match fixture warehouse ownership');

  const missingCatalogOwnRouteSmokeFile = path.join(dir, 'smoke-missing-catalog-own-route.json');
  const missingCatalogOwnRouteSmoke = sampleSmoke();
  missingCatalogOwnRouteSmoke.catalogAvailability.routeLegs = missingCatalogOwnRouteSmoke.catalogAvailability.routeLegs.filter((route) => route.warehouseId !== 'warehouse-own');
  writeJson(missingCatalogOwnRouteSmokeFile, missingCatalogOwnRouteSmoke);
  const missingCatalogOwnRouteReportFile = path.join(dir, 'report-missing-catalog-own-route.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: missingCatalogOwnRouteSmokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: missingCatalogOwnRouteReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: `WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=${approvalFile} TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js`,
  });
  const missingCatalogOwnRouteManifestFile = path.join(dir, 'manifest-missing-catalog-own-route.json');
  writeManifest(missingCatalogOwnRouteManifestFile, { fixture: fixtureFile, smoke: missingCatalogOwnRouteSmokeFile, deployment: deploymentFile, approval: approvalFile, report: missingCatalogOwnRouteReportFile }, serviceHeads);
  let missingCatalogOwnRouteRejected = false;
  try {
    verifyBundle({ manifestFile: missingCatalogOwnRouteManifestFile, reportFile: missingCatalogOwnRouteReportFile });
  } catch (error) {
    missingCatalogOwnRouteRejected = Boolean(error.message);
  }
  assert(missingCatalogOwnRouteRejected, 'bundle verifier must reject Catalog availability that omits the fixture own warehouse route');

  const nonReservableSupplierRouteSmokeFile = path.join(dir, 'smoke-non-reservable-supplier-route.json');
  const nonReservableSupplierRouteSmoke = sampleSmoke();
  nonReservableSupplierRouteSmoke.logisticsLegs = nonReservableSupplierRouteSmoke.logisticsLegs.map((route) => route.routeType === 'supplier_replenishment' ? { ...route, canReserveFromWarehouse: false } : route);
  nonReservableSupplierRouteSmoke.catalogAvailability.routeLegs = nonReservableSupplierRouteSmoke.catalogAvailability.routeLegs.map((route) => route.routeType === 'supplier_replenishment' ? { ...route, available: 0 } : route);
  nonReservableSupplierRouteSmoke.projection.routeLegs = nonReservableSupplierRouteSmoke.projection.routeLegs.map((route) => route.routeType === 'supplier_replenishment' ? { ...route, canReserveFromWarehouse: false } : route);
  writeJson(nonReservableSupplierRouteSmokeFile, nonReservableSupplierRouteSmoke);
  const nonReservableSupplierRouteManifestFile = path.join(dir, 'manifest-non-reservable-supplier-route.json');
  writeManifest(nonReservableSupplierRouteManifestFile, { fixture: fixtureFile, smoke: nonReservableSupplierRouteSmokeFile, deployment: deploymentFile, approval: approvalFile, report: reportFile }, serviceHeads);
  let nonReservableSupplierRouteRejected = false;
  try {
    verifyBundle({ manifestFile: nonReservableSupplierRouteManifestFile, reportFile: reportFile });
  } catch (error) {
    nonReservableSupplierRouteRejected = /supplier replenishment route/.test(error.message);
  }
  assert(nonReservableSupplierRouteRejected, 'bundle verifier must reject non-reservable supplier route evidence');

  const missingSupplierJobCatalogValidationSmokeFile = path.join(dir, 'smoke-missing-supplier-job-catalog-validation.json');
  const mismatchedSupplierJobFingerprintSmokeFile = path.join(dir, 'smoke-mismatched-supplier-job-fingerprint.json');
  const mismatchedSupplierJobFingerprintSmoke = sampleSmoke();
  mismatchedSupplierJobFingerprintSmoke.supplierJob.sourceFingerprint = 'trace:product-synthetic:warehouse-other:warehouse-dropship:7:SUP-SKU-TRACE';
  writeJson(mismatchedSupplierJobFingerprintSmokeFile, mismatchedSupplierJobFingerprintSmoke);
  const mismatchedSupplierJobFingerprintManifestFile = path.join(dir, 'manifest-mismatched-supplier-job-fingerprint.json');
  writeManifest(mismatchedSupplierJobFingerprintManifestFile, { fixture: fixtureFile, smoke: mismatchedSupplierJobFingerprintSmokeFile, deployment: deploymentFile, approval: approvalFile, report: reportFile }, serviceHeads);
  let mismatchedSupplierJobFingerprintRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedSupplierJobFingerprintManifestFile, reportFile: reportFile });
  } catch (error) {
    mismatchedSupplierJobFingerprintRejected = /source fingerprint/.test(error.message);
  }
  assert(mismatchedSupplierJobFingerprintRejected, 'bundle verifier must reject supplier job evidence from a different source fingerprint');

  const missingSupplierJobCatalogValidationSmoke = sampleSmoke();
  delete missingSupplierJobCatalogValidationSmoke.supplierJob.catalogProductValidationStatus;
  missingSupplierJobCatalogValidationSmoke.supplierJob.catalogProductIdsChecked = [];
  writeJson(missingSupplierJobCatalogValidationSmokeFile, missingSupplierJobCatalogValidationSmoke);
  const missingSupplierJobCatalogValidationManifestFile = path.join(dir, 'manifest-missing-supplier-job-catalog-validation.json');
  writeManifest(missingSupplierJobCatalogValidationManifestFile, { fixture: fixtureFile, smoke: missingSupplierJobCatalogValidationSmokeFile, deployment: deploymentFile, approval: approvalFile, report: reportFile }, serviceHeads);
  let missingSupplierJobCatalogValidationRejected = false;
  try {
    verifyBundle({ manifestFile: missingSupplierJobCatalogValidationManifestFile, reportFile: reportFile });
  } catch (error) {
    missingSupplierJobCatalogValidationRejected = /Catalog product validation/.test(error.message);
  }
  assert(missingSupplierJobCatalogValidationRejected, 'bundle verifier must reject supplier job without Catalog product validation evidence');

  const mismatchedStockAuthoritySmokeFile = path.join(dir, 'smoke-mismatched-stock-authority.json');
  const mismatchedStockAuthoritySmoke = sampleSmoke();
  mismatchedStockAuthoritySmoke.stockAuthority.catalogCoverageTotal = 10;
  writeJson(mismatchedStockAuthoritySmokeFile, mismatchedStockAuthoritySmoke);
  const mismatchedStockAuthorityManifestFile = path.join(dir, 'manifest-mismatched-stock-authority.json');
  writeManifest(mismatchedStockAuthorityManifestFile, { fixture: fixtureFile, smoke: mismatchedStockAuthoritySmokeFile, deployment: deploymentFile, approval: approvalFile, report: reportFile }, serviceHeads);
  let mismatchedStockAuthorityRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedStockAuthorityManifestFile, reportFile });
  } catch (error) {
    mismatchedStockAuthorityRejected = /stock authority/.test(error.message);
  }
  assert(mismatchedStockAuthorityRejected, 'bundle verifier must reject raw smoke stock authority totals that do not match Warehouse totals');

  const cleanupPlaceholderSmokeFile = path.join(dir, 'smoke-cleanup-placeholder.json');
  const cleanupPlaceholderSmoke = sampleSmoke();
  cleanupPlaceholderSmoke.cleanupEvidence = 'placeholder cleanup evidence after run';
  writeJson(cleanupPlaceholderSmokeFile, cleanupPlaceholderSmoke);
  const cleanupPlaceholderManifestFile = path.join(dir, 'manifest-cleanup-placeholder.json');
  writeManifest(cleanupPlaceholderManifestFile, { fixture: fixtureFile, smoke: cleanupPlaceholderSmokeFile, deployment: deploymentFile, approval: approvalFile, report: reportFile }, serviceHeads);
  let cleanupPlaceholderRejected = false;
  try {
    verifyBundle({ manifestFile: cleanupPlaceholderManifestFile, reportFile });
  } catch (error) {
    cleanupPlaceholderRejected = /cleanup or archival evidence/.test(error.message);
  }
  assert(cleanupPlaceholderRejected, 'bundle verifier must reject placeholder cleanup evidence');

  const missingProjectionOwnRouteSmokeFile = path.join(dir, 'smoke-missing-projection-own-route.json');
  const missingProjectionOwnRouteSmoke = sampleSmoke();
  missingProjectionOwnRouteSmoke.projection.routeLegs = missingProjectionOwnRouteSmoke.projection.routeLegs.filter((route) => route.warehouseId !== 'warehouse-own');
  writeJson(missingProjectionOwnRouteSmokeFile, missingProjectionOwnRouteSmoke);
  const missingProjectionOwnRouteReportFile = path.join(dir, 'report-missing-projection-own-route.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: missingProjectionOwnRouteSmokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: missingProjectionOwnRouteReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: `WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=${approvalFile} TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js`,
  });
  const missingProjectionOwnRouteManifestFile = path.join(dir, 'manifest-missing-projection-own-route.json');
  writeManifest(missingProjectionOwnRouteManifestFile, { fixture: fixtureFile, smoke: missingProjectionOwnRouteSmokeFile, deployment: deploymentFile, approval: approvalFile, report: missingProjectionOwnRouteReportFile }, serviceHeads);
  let missingProjectionOwnRouteRejected = false;
  try {
    verifyBundle({ manifestFile: missingProjectionOwnRouteManifestFile, reportFile: missingProjectionOwnRouteReportFile });
  } catch (error) {
    missingProjectionOwnRouteRejected = Boolean(error.message);
  }
  assert(missingProjectionOwnRouteRejected, 'bundle verifier must reject FlipFlop projection that omits the fixture own warehouse route');

  const missingCurrentHeadMarkerFile = path.join(dir, 'deployment-missing-current-head-marker.json');
  const missingCurrentHeadMarkerDeployment = sampleDeployment(readinessManifest);
  delete missingCurrentHeadMarkerDeployment.generatedFromCurrentHeads;
  writeJson(missingCurrentHeadMarkerFile, missingCurrentHeadMarkerDeployment);
  const missingCurrentHeadMarkerManifestFile = path.join(dir, 'manifest-missing-current-head-marker.json');
  writeManifest(missingCurrentHeadMarkerManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: missingCurrentHeadMarkerFile, approval: approvalFile, report: reportFile }, serviceHeads);
  let missingCurrentHeadDeploymentMarkerRejected = false;
  try {
    verifyBundle({ manifestFile: missingCurrentHeadMarkerManifestFile, reportFile });
  } catch (error) {
    missingCurrentHeadDeploymentMarkerRejected = /generated from current service heads/.test(error.message);
  }
  assert(missingCurrentHeadDeploymentMarkerRejected, 'bundle verifier must reject deployment evidence without current-head marker');

  const mismatchedDeploymentFile = path.join(dir, 'deployment-mismatched.json');
  const mismatchedDeployment = sampleDeployment(readinessManifest);
  mismatchedDeployment.services.catalog.commitSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  writeJson(mismatchedDeploymentFile, mismatchedDeployment);
  const mismatchedDeploymentEvidenceReportFile = path.join(dir, 'report-mismatched-deployment-head.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: mismatchedDeploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedDeploymentEvidenceReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=' + approvalFile + ' TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mismatchedManifestFile = path.join(dir, 'manifest-mismatched.json');
  writeManifest(mismatchedManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: mismatchedDeploymentFile, approval: approvalFile, report: mismatchedDeploymentEvidenceReportFile }, serviceHeads);
  let mismatchRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedManifestFile, reportFile: mismatchedDeploymentEvidenceReportFile });
  } catch (error) {
    mismatchRejected = /deployment evidence commit must match manifest service head/.test(error.message);
  }
  assert(mismatchRejected, 'bundle verifier must reject deployment evidence that does not match manifest heads');

  const mismatchedDeploymentReportFile = path.join(dir, 'report-mismatched-deployment-evidence.md');
  const mismatchedDeploymentReportEvidenceFile = path.join(dir, 'deployment-report-mismatched.json');
  const mismatchedDeploymentReportEvidence = sampleDeployment(readinessManifest);
  mismatchedDeploymentReportEvidence.services.warehouse.healthEvidence = '/api/health unrelated deployment returned 200';
  writeJson(mismatchedDeploymentReportEvidenceFile, mismatchedDeploymentReportEvidence);
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: mismatchedDeploymentReportEvidenceFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedDeploymentReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=' + approvalFile + ' TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mismatchedDeploymentReportManifestFile = path.join(dir, 'manifest-mismatched-deployment-report.json');
  writeManifest(mismatchedDeploymentReportManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: approvalFile, report: mismatchedDeploymentReportFile }, serviceHeads);
  let mismatchedDeploymentReportRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedDeploymentReportManifestFile, reportFile: mismatchedDeploymentReportFile });
  } catch (error) {
    mismatchedDeploymentReportRejected = /deployment row must match hashed deployment evidence/.test(error.message);
  }
  assert(mismatchedDeploymentReportRejected, 'bundle verifier must reject runtime reports generated from deployment evidence that differs from the manifest deployment artifact');

  const missingApprovalManifestFile = path.join(dir, 'manifest-missing-approval.json');
  writeManifest(missingApprovalManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, report: reportFile }, serviceHeads);
  let missingApprovalArtifactRejected = false;
  try {
    verifyBundle({ manifestFile: missingApprovalManifestFile, reportFile });
  } catch (error) {
    missingApprovalArtifactRejected = /missing artifact approval|missing approval artifact/.test(error.message);
  }
  assert(missingApprovalArtifactRejected, 'bundle verifier must reject runtime evidence without approval artifact');

  const staleApprovalFile = path.join(dir, 'approval-stale.json');
  writeApprovalArtifact(staleApprovalFile, readinessManifest, { ...serviceHeads, suppliers: 'cccccccccccccccccccccccccccccccccccccccc' });
  const staleApprovalManifestFile = path.join(dir, 'manifest-stale-approval.json');
  writeManifest(staleApprovalManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: staleApprovalFile, report: reportFile }, serviceHeads);
  let staleApprovalArtifactRejected = false;
  try {
    verifyBundle({ manifestFile: staleApprovalManifestFile, reportFile });
  } catch (error) {
    staleApprovalArtifactRejected = /head must match|approvalRequest must match readiness manifest|readiness manifest file .*head must match/.test(error.message);
  }
  assert(staleApprovalArtifactRejected, 'bundle verifier must reject approval artifact for different service heads');

  const mismatchedCommandProductReportFile = path.join(dir, 'report-mismatched-command-product.md');
  const mismatchedCommandProductFixtureFile = path.join(dir, 'fixture-mismatched-command-product.json');
  const mismatchedCommandProductSmokeFile = path.join(dir, 'smoke-mismatched-command-product.json');
  const mismatchedCommandProductFixture = sampleFixture();
  const mismatchedCommandProductSmoke = sampleSmoke();
  mismatchedCommandProductFixture.productId = 'product-other';
  mismatchedCommandProductSmoke.productId = 'product-other';
  mismatchedCommandProductSmoke.catalogProduct.id = 'product-other';
  mismatchedCommandProductSmoke.supplierImport.sourceFingerprint = 'trace:product-other:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE';
  mismatchedCommandProductSmoke.supplierJob.sourceFingerprint = mismatchedCommandProductSmoke.supplierImport.sourceFingerprint;
  mismatchedCommandProductSmoke.supplierJob.catalogProductIdsChecked = ['product-other'];
  writeJson(mismatchedCommandProductFixtureFile, mismatchedCommandProductFixture);
  writeJson(mismatchedCommandProductSmokeFile, mismatchedCommandProductSmoke);
  const mismatchedCommandProductApprovalFile = path.join(dir, 'approval-command-product.json');
  writeApprovalArtifact(mismatchedCommandProductApprovalFile, readinessManifest, serviceHeads);
  const mismatchedCommandProductApproval = readJson(mismatchedCommandProductApprovalFile, 'mismatched command product approval');
  mismatchedCommandProductApproval.approvedTraceInputs.TRACE_PRODUCT_ID = 'product-other';
  writeJson(mismatchedCommandProductApprovalFile, mismatchedCommandProductApproval);
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: mismatchedCommandProductFixtureFile,
    SMOKE_RESULT_FILE: mismatchedCommandProductSmokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedCommandProductReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-other TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-other TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=' + mismatchedCommandProductApprovalFile + ' TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mismatchedCommandProductManifestFile = path.join(dir, 'manifest-mismatched-command-product.json');
  writeManifest(mismatchedCommandProductManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: mismatchedCommandProductApprovalFile, report: mismatchedCommandProductReportFile }, serviceHeads);
  let mismatchedCommandProductRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedCommandProductManifestFile, reportFile: mismatchedCommandProductReportFile });
  } catch (error) {
    mismatchedCommandProductRejected = /command TRACE_PRODUCT_ID must match/.test(error.message);
  }
  assert(mismatchedCommandProductRejected, 'bundle verifier must reject report command product IDs that do not match hashed fixture and smoke artifacts');

  const mismatchedCommandIdempotencyReportFile = path.join(dir, 'report-mismatched-command-idempotency.md');
  const mismatchedCommandIdempotencyApprovalFile = path.join(dir, 'approval-command-idempotency.json');
  writeApprovalArtifact(mismatchedCommandIdempotencyApprovalFile, readinessManifest, serviceHeads);
  const mismatchedCommandIdempotencyApproval = readJson(mismatchedCommandIdempotencyApprovalFile, 'mismatched command idempotency approval');
  mismatchedCommandIdempotencyApproval.approvedTraceInputs.TRACE_IMPORT_IDEMPOTENCY_KEY = 'manual:traceability-other';
  writeJson(mismatchedCommandIdempotencyApprovalFile, mismatchedCommandIdempotencyApproval);
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedCommandIdempotencyReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-other TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=' + mismatchedCommandIdempotencyApprovalFile + ' TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mismatchedCommandIdempotencyManifestFile = path.join(dir, 'manifest-mismatched-command-idempotency.json');
  writeManifest(mismatchedCommandIdempotencyManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: mismatchedCommandIdempotencyApprovalFile, report: mismatchedCommandIdempotencyReportFile }, serviceHeads);
  let mismatchedCommandIdempotencyRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedCommandIdempotencyManifestFile, reportFile: mismatchedCommandIdempotencyReportFile });
  } catch (error) {
    mismatchedCommandIdempotencyRejected = /command TRACE_IMPORT_IDEMPOTENCY_KEY must match/.test(error.message);
  }
  assert(mismatchedCommandIdempotencyRejected, 'bundle verifier must reject report command idempotency key that does not match the hashed smoke artifact');

  const mismatchedApprovalInputsFile = path.join(dir, 'approval-mismatched-inputs.json');
  writeApprovalArtifact(mismatchedApprovalInputsFile, readinessManifest, serviceHeads);
  const mismatchedApprovalInputs = readJson(mismatchedApprovalInputsFile, 'mismatched approval inputs');
  mismatchedApprovalInputs.approvedTraceInputs.TRACE_SUPPLIER_STOCK_QTY = '8';
  writeJson(mismatchedApprovalInputsFile, mismatchedApprovalInputs);
  const mismatchedApprovalInputsReportFile = path.join(dir, 'report-mismatched-approval-inputs.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedApprovalInputsReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=' + mismatchedApprovalInputsFile + ' TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mismatchedApprovalInputsManifestFile = path.join(dir, 'manifest-mismatched-approval-inputs.json');
  writeManifest(mismatchedApprovalInputsManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: mismatchedApprovalInputsFile, report: mismatchedApprovalInputsReportFile }, serviceHeads);
  let mismatchedApprovalInputsRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedApprovalInputsManifestFile, reportFile: mismatchedApprovalInputsReportFile });
  } catch (error) {
    mismatchedApprovalInputsRejected = /approved smoke command TRACE_SUPPLIER_STOCK_QTY/.test(error.message);
  }
  assert(mismatchedApprovalInputsRejected, 'bundle verifier must reject approval trace inputs that differ from the report command');

  const mismatchedApprovalPathReportFile = path.join(dir, 'report-mismatched-approval-path.md');
  runNodeJson(['reports/validation/generate-runtime-evidence-report.js'], {
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: deploymentFile,
    RUNTIME_EVIDENCE_OUTPUT: mismatchedApprovalPathReportFile,
    REDACTED_FIXTURE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check',
    REDACTED_SMOKE_COMMAND: 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=/tmp/other-runtime-approval.json TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js',
  });
  const mismatchedApprovalPathManifestFile = path.join(dir, 'manifest-mismatched-approval-path.json');
  writeManifest(mismatchedApprovalPathManifestFile, { fixture: fixtureFile, smoke: smokeFile, deployment: deploymentFile, approval: approvalFile, report: mismatchedApprovalPathReportFile }, serviceHeads);
  let mismatchedApprovalPathRejected = false;
  try {
    verifyBundle({ manifestFile: mismatchedApprovalPathManifestFile, reportFile: mismatchedApprovalPathReportFile });
  } catch (error) {
    mismatchedApprovalPathRejected = /approval artifact path must match manifest/.test(error.message);
  }
  assert(mismatchedApprovalPathRejected, 'bundle verifier must reject report command approval path that does not match manifest approval artifact');

  return { ...passed, mixedTraceProductRejected: true, mixedSupplierWarehouseRejected: true, mismatchedSupplierRejected: true, missingCatalogOwnRouteRejected: true, nonReservableSupplierRouteRejected: true, mismatchedSupplierJobFingerprintRejected: true, missingSupplierJobCatalogValidationRejected: true, mismatchedStockAuthorityRejected: true, cleanupPlaceholderRejected: true, missingProjectionOwnRouteRejected: true, deploymentManifestMismatchRejected: true, missingCurrentHeadDeploymentMarkerRejected: true, mismatchedDeploymentReportRejected: true, missingApprovalArtifactRejected: true, staleApprovalArtifactRejected: true, mismatchedCommandProductRejected: true, mismatchedCommandIdempotencyRejected: true, mismatchedApprovalPathRejected: true, mismatchedApprovalInputsRejected: true };
}

try {
  const result = selfTest ? runSelfTest() : verifyBundle({ manifestFile: process.env.RUNTIME_EVIDENCE_MANIFEST || process.argv[2], reportFile: process.env.RUNTIME_EVIDENCE_REPORT || process.argv[3] });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
