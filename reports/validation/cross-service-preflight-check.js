#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
    patterns: ['@Get(\'topology\')', '@Post(\'logistics/batch\')'],
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
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.controller.ts',
    patterns: ['coverage/audit', 'coverage'],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.service.ts',
    patterns: ['warehouses/logistics/batch', 'mixed_stock', 'warehouse_logistics_route_missing'],
  },
  {
    service: 'catalog',
    file: 'src/flipflop-projection/flipflop-projection.service.ts',
    patterns: ['availability.warehouses', 'availability.logistics'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/imports.service.ts',
    patterns: ['apply_with_owner_approval', 'warehouseStockUpdateApproved', 'supplier-reconciliations', 'requireForSupplier'],
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
    patterns: ['synthetic-trace', 'trace:<productId>:<warehouseId>:<quantity>[:supplierSku]'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/production-rest-json-supplier-adapter.ts',
    patterns: ['PRODUCTION-REST-JSON-V1', 'maxRedirects: 0', 'apiCredentials', 'sourceFingerprint'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-stock-traceability-smoke.js',
    patterns: ['TRACE_RUN_SUPPLIERS_IMPORT', 'TRACE_CLEANUP_EVIDENCE', 'TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-', 'readHealth', "service, endpoint", 'catalogRouteTypes', 'projectionRouteTypes', 'stockAuthority', 'warehouseTotalAvailable', 'warehouses/logistics/batch', 'availability/coverage/audit', 'catalogAvailability'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/generate-runtime-evidence-report.js',
    patterns: ['VAL-CROSS-STOCK-RUNTIME-LIVE', 'Runtime complete', 'summarizeCatalogAvailability', 'summarizeStockAuthority', 'stockAuthorityComplete', 'hasLocalAndSupplierRoute', 'deploymentEvidenceComplete', 'isCommitSha', 'namedHealthComplete', 'expectedSkuPrefix', '401|403', "source === 'warehouse'"],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-report.js',
    patterns: ['REQUIRED_ASSERTIONS', 'Warehouse remains stock authority across totals', 'warehouseTotalAvailable=', 'catalogCoverageTotal=', 'deployment evidence must include a commit SHA', 'warehouse:', 'catalog:', 'suppliers:', 'source=warehouse', 'expectedSkuPrefix=CODEX-STOCK-TRACE-', 'routeTypes=local_fulfillment', 'supplier_dropship', 'logisticsOptionCount', 'protected endpoint evidence must include 401 or 403', 'missing-runtime'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-evidence-negative-check.js',
    patterns: ['bad-sku-prefix', 'unnamed-health', 'missing-forwarded-supplier-route', 'mismatched-stock-authority-total', 'invalid-deployment-commit-sha', 'missing-deployment-service-row', 'missing-protected-endpoint-auth-evidence', 'failed-runtime'],
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

function main() {
  const directories = Object.entries(services).map(([name, dir]) => assertServiceDirectory(name, dir));
  const sourceChecks = checks.map(runCheck);
  const ok = directories.every((item) => item.ok) && sourceChecks.every((item) => item.ok);
  const result = {
    status: ok ? 'passed' : 'failed',
    root,
    directories,
    sourceChecks,
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
