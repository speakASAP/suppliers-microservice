#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const root = process.env.CROSS_SERVICE_ROOT || path.resolve(__dirname, '../../..');

const services = {
  warehouse: path.join(root, 'warehouse-microservice'),
  catalog: path.join(root, 'catalog-microservice'),
  suppliers: path.join(root, 'suppliers-microservice'),
};

const checks = [
  {
    service: 'warehouse',
    file: 'src/warehouses/warehouses.controller.ts',
    patterns: ['BatchWarehouseLogisticsDto', "@Get('topology')", "@Post('logistics/batch')"],
  },
  {
    service: 'warehouse',
    file: 'src/warehouses/dto/warehouse.dto.ts',
    patterns: ['BatchWarehouseLogisticsDto', 'ArrayNotEmpty', 'ArrayMaxSize(200)', 'IsString({ each: true })'],
  },
  {
    service: 'warehouse',
    file: 'test/warehouses.dto.spec.ts',
    patterns: ['BatchWarehouseLogisticsDto', 'rejects missing, empty, and oversized logistics batch requests', 'rejects non-string product identifiers'],
  },
  {
    service: 'warehouse',
    file: 'src/warehouses/warehouses.service.ts',
    patterns: ['supplier_replenishment', 'supplier_dropship', 'getInventoryTopology', 'getBatchProductLogistics'],
  },
  {
    service: 'warehouse',
    file: 'src/stock/stock.service.ts',
    patterns: ['warehouseType', 'supplierId'],
  },
  {
    service: 'warehouse',
    file: 'src/suppliers/supplier-reconciliation.service.ts',
    patterns: ['is supplier-managed but is not linked to a supplier', 'belongs to supplier', 'supplier_reconciliation', 'const existing = await reconciliationRepository.findOne'],
  },
  {
    service: 'warehouse',
    file: 'test/supplier-reconciliation.service.spec.ts',
    patterns: ['returns the existing reconciliation when a supplier reference is replayed after validating warehouse ownership', 'rejects replayed reconciliation when the warehouse is no longer linked to the request supplier', 'rejects supplier-managed warehouses that are not linked to a supplier', 'rejects supplier reconciliation when the warehouse belongs to another supplier'],
  },
  {
    service: 'warehouse',
    file: 'docs/contracts/supplier-reconciliation-contract.md',
    patterns: ['Supplier-managed warehouses must have a Warehouse-owned `supplierId`', 'must match the request supplier'],
  },
  {
    service: 'warehouse',
    file: 'test/warehouses.service.spec.ts',
    patterns: ['supplier_replenishment', 'supplier_dropship', 'OWN-PRG', 'SUP-BETA', 'DROP-ACME', 'alfares_receiving_or_handoff', "responsibility: 'supplier'", "responsibility: 'warehouse'"],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.controller.ts',
    patterns: ['coverage/audit', 'coverage'],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.service.ts',
    patterns: ['warehouses/logistics/batch', 'indexWarehouseLogisticsPlans', 'resolveConsistentLogisticsPlan', 'Ignoring stale Warehouse logistics plan', 'mixed_stock', 'warehouse_logistics_route_missing'],
  },
  {
    service: 'catalog',
    file: 'src/flipflop-projection/flipflop-projection.service.ts',
    patterns: ['availability.warehouses', 'availability.logistics'],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.service.spec.ts',
    patterns: ['supplier_replenishment', 'supplier_dropship', 'alfares_receiving_or_handoff', "to: 'customer'", "responsibility: 'supplier'", "responsibility: 'warehouse'", 'does not attach stale Warehouse logistics', 'ignores duplicate and unrequested Warehouse logistics plans'],
  },
  {
    service: 'catalog',
    file: 'src/flipflop-projection/flipflop-projection.service.spec.ts',
    patterns: ['availability:', 'logistics:', 'legs:', 'OWN-PRG', 'to: "customer"', 'responsibility: "warehouse"'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/imports.service.ts',
    patterns: ['apply_with_owner_approval', 'warehouseStockUpdateApproved', 'supplier-reconciliations', 'requireForSupplier'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/import-validation.ts',
    patterns: ['seenWarehouseCandidates', 'Duplicate Warehouse stock candidate', 'productId', 'warehouseId'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/imports.module.ts',
    patterns: ['SyntheticTraceSupplierAdapter', 'ProductionRestJsonSupplierAdapter'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/supplier-import-adapter.ts',
    patterns: ['SupplierAdapterRunSupplier', 'apiCredentials', 'supplier?: SupplierAdapterRunSupplier'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/supplier-adapter-registry.ts',
    patterns: ['requireForSupplier', 'adapterKeys'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/synthetic-trace-supplier-adapter.ts',
    patterns: ['synthetic-trace', 'trace:<productId>:<warehouseId>:<quantity>[:supplierSku]', 'trace:<productId>:<supplierWarehouseId>:<dropshipWarehouseId>:<quantity>[:supplierSku]'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/production-rest-json-supplier-adapter.ts',
    patterns: ['PRODUCTION-REST-JSON-V1', 'maxRedirects: 0', 'apiCredentials', 'sourceFingerprint'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/synthetic-stock-traceability-check.js',
    patterns: ['hasLocalCustomerLeg', 'hasSupplierCustomerPath', 'routeLegs', 'supplier_dropship', 'responsibility: "supplier"', 'responsibility: "warehouse"'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-stock-traceability-smoke.js',
    patterns: ['TRACE_RUN_SUPPLIERS_IMPORT', 'TRACE_CLEANUP_EVIDENCE', 'TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-', 'TRACE_DROPSHIP_WAREHOUSE_ID', 'fixtureCheck', 'readHealth', "service, endpoint", 'catalogRouteTypes', 'projectionRouteTypes', 'summarizeLogisticsLegs', 'hasRequiredLogisticsLegs', 'stockAuthority', 'warehouseTotalAvailable', 'assertConfiguredSupplierOwnership', 'assertConfiguredRouteSupplierOwnership', 'assertConfiguredRoute', 'Catalog forwarded own', 'FlipFlop forwarded own', 'warehouses/logistics/batch', 'availability/coverage/audit', 'catalogAvailability'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/generate-runtime-evidence-report.js',
    patterns: ['VAL-CROSS-STOCK-RUNTIME-LIVE', 'Runtime complete', 'summarizeCatalogAvailability', 'summarizeStockAuthority', 'stockAuthorityComplete', 'summarizeFixtureCheck', 'fixtureCheckComplete', 'FIXTURE_CHECK_RESULT_FILE', 'hasAllRequiredRouteTypes', 'hasRequiredRouteLegs', 'summarizeRouteLegs', 'deploymentEvidenceComplete', 'generatedFromCurrentHeads', 'isCommitSha', 'namedHealthComplete', 'expectedSkuPrefix', '401|403', "source === 'warehouse'"],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-deployment-evidence-template.js',
    patterns: ['DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT', 'warehouse-microservice', 'catalog-microservice', 'suppliers-microservice', 'protectedEndpointEvidencePlaceholder', 'assertCleanWorktree', 'worktree must be clean before generating deployment evidence', 'generatedFromCurrentHeads', 'Regenerate this template after any Warehouse, Catalog, or Suppliers commit', 'verify-stock-traceability-completion.js', 'TODO'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/run-runtime-evidence-flow.js',
    patterns: ['--fixture-check', 'RUN_APPROVED_RUNTIME_SMOKE=true', 'fixture-ready', 'validateApprovedSmokeConfig', 'validateDeploymentEvidenceFile', 'generatedFromCurrentHeads', 'completion verifier reminder', 'assertCleanWorktreeForService', 'worktree must be clean before approved runtime evidence', 'currentHeadForService', 'commitSha must match current', 'OWNER_APPROVAL=explicit', 'SMOKE_ALLOW_MUTATION=true', 'TRACE_OWN_WAREHOUSE_ID', 'FIXTURE_CHECK_RESULT_FILE', 'generate-runtime-evidence-report.js', 'verify-runtime-evidence-report.js', 'verify-runtime-evidence-manifest.js', 'verify-runtime-evidence-bundle.js', 'RUNTIME_EVIDENCE_MANIFEST', 'stock-traceability-runtime-evidence-manifest.json', 'sha256', '--manifest-self-test'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-runtime-handoff-checklist.js',
    patterns: ['STOCK-TRACEABILITY-RUNTIME-HANDOFF', 'RUNTIME_HANDOFF_OUTPUT', 'completionGate', 'formatCompletionReason', 'TRACE_SUPPLIER_WAREHOUSE_ID linked to TRACE_SUPPLIER_ID', 'same TRACE_SUPPLIER_ID owns the supplier replenishment and dropship warehouse origins and route options', 'Deploy Warehouse first', 'RUN_APPROVED_RUNTIME_SMOKE=true', 'verify-runtime-evidence-manifest.js <manifest-file>', 'verify-runtime-evidence-bundle.js <manifest-file> <report-file>', 'verify-stock-traceability-completion.js <report-file> <manifest-file>', 'run-runtime-evidence-flow.js'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-stock-traceability-completion.js',
    patterns: ['runtime report is not passed-runtime/runtime-complete', 'no runtime evidence manifest was provided', 'defaultManifest', 'verify-runtime-evidence-bundle.js', 'complete verified bundle'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-bundle.js',
    patterns: ['verify-runtime-evidence-manifest.js', 'verify-runtime-evidence-report.js', 'deployment evidence commit must match manifest service head', 'fixture and smoke artifacts must use the same TRACE_PRODUCT_ID', 'smoke artifact must include the fixture dropship warehouse origin for TRACE_SUPPLIER_ID', 'fixture supplier warehouse origin must belong to TRACE_SUPPLIER_ID', 'Runtime complete', 'mixedTraceProductRejected', 'mixedSupplierWarehouseRejected', 'mismatchedSupplierRejected', 'missingCatalogOwnRouteRejected', 'missingProjectionOwnRouteRejected', 'deploymentManifestMismatchRejected', 'missingCurrentHeadDeploymentMarkerRejected'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-manifest.js',
    patterns: ['runtime-complete-evidence-bundle', 'sha256 mismatch', 'tamperedHashRejected', 'currentHeadForService', 'fixture', 'smoke', 'deployment', 'report'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-report.js',
    patterns: ['REQUIRED_ASSERTIONS', 'Read-only live fixture check passed before mutation', 'Warehouse remains stock authority across totals', 'warehouseTotalAvailable=', 'catalogCoverageTotal=', 'deployment evidence must include a commit SHA', 'TRACE_RUN_SUPPLIERS_IMPORT=true', 'TRACE_EXPECT_SUPPLIERS_JOB=true', 'TRACE_DROPSHIP_WAREHOUSE_ID=', '--fixture-check', 'fixture-ready', 'mutationEnabled=no', 'TRACE_CLEANUP_EVIDENCE=', 'warehouse:', 'catalog:', 'suppliers:', 'source=warehouse', 'expectedSkuPrefix=CODEX-STOCK-TRACE-', 'routeTypes=local_fulfillment', 'routeLegs=', 'hasSupplierOriginEvidence', 'positive availability and supplier IDs', 'customer:warehouse', 'supplier_dropship', 'logisticsOptionCount', 'protected endpoint evidence must include 401 or 403', 'missing-runtime'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-evidence-flow-negative-check.js',
    patterns: ['approved-smoke-missing-deployment-evidence', 'approved-smoke-missing-own-warehouse-id', 'approved-smoke-missing-owner-approval', 'approved-smoke-missing-mutation-allowance', 'approved-smoke-invalid-deployment-evidence', 'approved-smoke-deployment-sha-not-current-head', 'approved-smoke-missing-current-head-deployment-marker', 'approved-smoke-dirty-service-worktree', 'approved-smoke-missing-protected-endpoint-evidence', 'approved-smoke-health-evidence-still-placeholder', 'approved-smoke-template-not-complete-evidence', 'RUN_APPROVED_RUNTIME_SMOKE', 'DEPLOYMENT_EVIDENCE_FILE', 'generatedFromCurrentHeads', 'verify-stock-traceability-completion.js', 'verify-runtime-evidence-manifest.js', 'verify-runtime-evidence-bundle.js', 'mixedTraceProductRejected', 'mixedSupplierWarehouseRejected', 'mismatchedSupplierRejected', 'missingCatalogOwnRouteRejected', 'missingProjectionOwnRouteRejected', '--manifest-self-test'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-evidence-negative-check.js',
    patterns: ['bad-sku-prefix', 'unnamed-health', 'missing-forwarded-supplier-route', 'missing-logistics-leg-evidence', 'missing-origin-supplier-id-report-evidence', 'missing-fixture-check-evidence', 'mismatched-stock-authority-total', 'invalid-deployment-commit-sha', 'missing-deployment-service-row', 'missing-protected-endpoint-auth-evidence', 'deployment-health-evidence-placeholder', 'missing-current-head-deployment-marker', 'invalid-smoke-command-import-disabled', 'failed-runtime'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-live-runbook.md',
    patterns: ['`TRACE_SUPPLIER_ID` ownership for supplier-managed origins and routes', 'supplier/dropship warehouse IDs'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-runtime-evidence-template.md',
    patterns: ['supplier ID matching `TRACE_SUPPLIER_ID`', 'supplier routes owned by `TRACE_SUPPLIER_ID`', 'not owned by the same `TRACE_SUPPLIER_ID`'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-completion-audit.md',
    patterns: ['supplier IDs match `TRACE_SUPPLIER_ID`', 'supplier routes are owned by `TRACE_SUPPLIER_ID`'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/production-rest-json-adapter-check.js',
    patterns: ['PRODUCTION_REST_JSON_ADAPTER_KEY', 'credentialRefsResolvedAtRuntime', 'invalidPayloadBlocked'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/synthetic-production-rest-json-adapter-check.js',
    patterns: ['SYN_REST_API_KEY', 'SYN_REST_TOKEN', 'deterministicFingerprint'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/synthetic-approved-import-run-check.js',
    patterns: ['duplicateWarehouseCandidateRejected', 'Duplicate Warehouse stock candidate', 'approved mutation must include supplier replenishment warehouse', 'approved mutation must include dropship warehouse'],
  },
];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function assertServiceDirectory(name, dir) {
  if (!fs.existsSync(dir)) {
    return { service: name, ok: false, error: `missing service directory ${dir}` };
  }

  const status = git(dir, ['status', '--short']);
  const head = git(dir, ['rev-parse', 'HEAD']);
  const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const requiredFiles = ['package.json', 'scripts/deploy.sh'];
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(dir, file)));

  return {
    service: name,
    ok: missing.length === 0,
    branch,
    head,
    dirtyLines: status ? status.split('\n').length : 0,
    missingRequiredFiles: missing,
  };
}

function runCheck(check) {
  const serviceDir = services[check.service];
  const filePath = path.join(serviceDir, check.file);
  if (!fs.existsSync(filePath)) {
    return { ...check, ok: false, error: 'file missing' };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const missingPatterns = check.patterns.filter((pattern) => !text.includes(pattern));
  return {
    service: check.service,
    file: check.file,
    ok: missingPatterns.length === 0,
    missingPatterns,
  };
}


function checkCompletionGate() {
  const result = spawnSync(process.execPath, ['reports/validation/verify-stock-traceability-completion.js'], {
    cwd: services.suppliers,
    env: { ...process.env },
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  let parsed = null;
  try {
    parsed = output ? JSON.parse(output) : null;
  } catch (_error) {
    parsed = { status: 'failed', raw: output };
  }
  if (result.status === 0 && parsed?.status === 'complete') {
    return { service: 'suppliers', ok: true, status: 'complete', result: parsed };
  }
  if (result.status === 2 && parsed?.status === 'incomplete') {
    return { service: 'suppliers', ok: true, status: 'incomplete', result: parsed };
  }
  return { service: 'suppliers', ok: false, status: parsed?.status || 'failed', result: parsed, exitCode: result.status };
}

function checkLiveRuntimeReport() {
  const reportFile = path.join(services.suppliers, 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md');
  if (!fs.existsSync(reportFile)) {
    return { service: 'suppliers', file: path.relative(services.suppliers, reportFile), ok: true, status: 'absent' };
  }

  const report = fs.readFileSync(reportFile, 'utf8');
  if (!report.includes('- status: passed-runtime')) {
    return { service: 'suppliers', file: path.relative(services.suppliers, reportFile), ok: true, status: 'not-passed-runtime' };
  }

  try {
    execFileSync('node', ['reports/validation/verify-runtime-evidence-report.js'], {
      cwd: services.suppliers,
      env: { ...process.env, RUNTIME_EVIDENCE_REPORT: reportFile },
      stdio: 'pipe',
    });
    return { service: 'suppliers', file: path.relative(services.suppliers, reportFile), ok: true, status: 'verified-passed-runtime' };
  } catch (error) {
    return {
      service: 'suppliers',
      file: path.relative(services.suppliers, reportFile),
      ok: false,
      status: 'stale-or-invalid-passed-runtime',
      error: error.stdout?.toString() || error.stderr?.toString() || error.message,
    };
  }
}

function main() {
  const directories = Object.entries(services).map(([name, dir]) => assertServiceDirectory(name, dir));
  const sourceChecks = checks.map(runCheck);
  const liveRuntimeReport = checkLiveRuntimeReport();
  const completionGate = checkCompletionGate();
  const ok = directories.every((item) => item.ok) && sourceChecks.every((item) => item.ok) && liveRuntimeReport.ok && completionGate.ok;
  const result = {
    status: ok ? 'passed' : 'failed',
    root,
    directories,
    sourceChecks,
    liveRuntimeReport,
    completionGate,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
