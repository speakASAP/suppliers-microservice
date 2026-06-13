#!/usr/bin/env node
const fs = require('fs');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');

const REQUIRED_ASSERTIONS = [
  'Read-only live fixture check passed before mutation.',
  'Warehouse, Catalog, and Suppliers health endpoints passed.',
  'Catalog product identity exists.',
  'Warehouse topology distinguishes own and supplier-managed warehouses.',
  'Warehouse availability returns own plus supplier and dropship stock.',
  'Warehouse logistics returns local, supplier replenishment, and dropship route options.',
  'Catalog availability forwards Warehouse origin rows and logistics.',
  'Catalog coverage and audit classify covered mixed stock.',
  'FlipFlop projection forwards Warehouse-sourced availability and logistics.',
  'Suppliers import preserves Catalog identity and Warehouse authority.',
  'Warehouse remains stock authority across totals.',
  'Cleanup or archival evidence is recorded.',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rowCells(row) {
  return row.split('|').map((cell) => cell.trim()).filter(Boolean);
}

function sampleReport() {
  return `# VAL-CROSS-STOCK-RUNTIME-LIVE - Cross-Service Runtime Traceability Validation

Metadata:
- id: VAL-CROSS-STOCK-RUNTIME-LIVE
- status: passed-runtime
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: runtime-complete
- upstream: docs/cross-service/stock-traceability-live-runbook.md, docs/cross-service/stock-traceability-completion-audit.md, reports/validation/runtime-stock-traceability-smoke.js

## Artifact Validated

Owner-approved deployed Warehouse, Catalog, and Suppliers runtime traceability path for one synthetic Catalog good.

## Fixture Check Command Evidence

\`\`\`bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check
\`\`\`

## Smoke Command Evidence

\`\`\`bash
WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=/tmp/stock-traceability-runtime-approval.json TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js
\`\`\`

## Deployment Evidence

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | ./scripts/deploy.sh | /api/health passed | anonymous topology returned 401 |
| Catalog | bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | ./scripts/deploy.sh | /health passed | anonymous coverage returned 401 |
| Suppliers | cccccccccccccccccccccccccccccccccccccccc | ./scripts/deploy.sh | /api/health passed | anonymous imports returned 401 |

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Read-only live fixture check passed before mutation. | status=fixture-ready, fixtureCheck=yes, mutationEnabled=no, importTriggered=no, own=warehouse-own, supplier=warehouse-supplier, dropship=warehouse-dropship, routes=local_fulfillment,supplier_replenishment,supplier_dropship | passed-runtime |
| Warehouse, Catalog, and Suppliers health endpoints passed. | warehouse: ok; catalog: ok; suppliers: ok | passed-runtime |
| Catalog product identity exists. | productId=product-synthetic, sku=CODEX-STOCK-TRACE-001, expectedSkuPrefix=CODEX-STOCK-TRACE- | passed-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | own=1, supplierManaged=1 | passed-runtime |
| Warehouse availability returns own plus supplier and dropship stock. | own:warehouse-own:available=4:supplier=-; supplier:warehouse-supplier:available=3:supplier=supplier-synthetic; dropship:warehouse-dropship:available=7:supplier=supplier-synthetic | passed-runtime |
| Warehouse logistics returns local, supplier replenishment, and dropship route options. | routes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[available=4;reservable=yes;warehouse=warehouse-own;supplier=-;1:OWN>customer:warehouse],supplier_replenishment[available=3;reservable=yes;warehouse=warehouse-supplier;supplier=supplier-synthetic;1:SUP>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=warehouse-dropship;supplier=supplier-synthetic;1:DROP>customer:supplier] | passed-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | source=warehouse, warehouseCount=3, logisticsOptionCount=3, preferredRoute=local_fulfillment, routeTypes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[available=4;reservable=yes;warehouse=warehouse-own;supplier=-;1:OWN>customer:warehouse],supplier_replenishment[available=3;reservable=yes;warehouse=warehouse-supplier;supplier=supplier-synthetic;1:SUP>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=warehouse-dropship;supplier=supplier-synthetic;1:DROP>customer:supplier] | passed-runtime |
| Catalog coverage and audit classify covered mixed stock. | covered/mixed_stock | passed-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | productId=product-synthetic, source=warehouse, routeCount=3, routeTypes=local_fulfillment,supplier_replenishment,supplier_dropship, routeLegs=local_fulfillment[available=4;reservable=yes;warehouse=warehouse-own;supplier=-;1:OWN>customer:warehouse],supplier_replenishment[available=3;reservable=yes;warehouse=warehouse-supplier;supplier=supplier-synthetic;1:SUP>alfares_receiving_or_handoff:supplier/2:alfares_receiving_or_handoff>customer:warehouse],supplier_dropship[available=7;reservable=yes;warehouse=warehouse-dropship;supplier=supplier-synthetic;1:DROP>customer:supplier] | passed-runtime |
| Suppliers import preserves Catalog identity and Warehouse authority. | catalogProductValidation=passed, checkedProducts=product-synthetic, sourceFingerprint=trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE, authority=warehouse-microservice | passed-runtime |
| Warehouse remains stock authority across totals. | source=warehouse, warehouseTotalAvailable=11, warehouseOriginAvailable=11, catalogAvailabilityTotal=11, catalogCoverageTotal=11, projectionStockQuantity=11 | passed-runtime |
| Cleanup or archival evidence is recorded. | cleanupEvidence=deferred:traceability-runbook | passed-runtime |

## Completion Decision

Runtime complete

## Boundary Evidence

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval or remained deferred by recorded evidence.
`;
}

function countAssertionRows(report) {
  return report
    .split('\n')
    .filter((line) => line.startsWith('| ') && line.endsWith(' |') && line.includes('passed-runtime'))
    .length;
}

function assertionRows(report) {
  return report
    .split('\n')
    .filter((line) => line.startsWith('| ') && line.endsWith(' |') && line.includes('passed-runtime'));
}

function sectionText(report, heading) {
  const marker = "## " + heading;
  const start = report.indexOf(marker);
  if (start === -1) return "";
  const next = report.indexOf("\n## ", start + marker.length);
  return next === -1 ? report.slice(start) : report.slice(start, next);
}

function commandEnvValue(section, key) {
  const token = section.split(/\s+/).find((part) => part.startsWith(key + '='));
  if (!token) return null;
  return token.slice(key.length + 1).replace(/^['"]|['"]$/g, '');
}

function assertReportIncludesTraceWarehouseIds(row, commandEvidence, label) {
  for (const key of ['TRACE_OWN_WAREHOUSE_ID', 'TRACE_SUPPLIER_WAREHOUSE_ID', 'TRACE_DROPSHIP_WAREHOUSE_ID']) {
    const value = commandEnvValue(commandEvidence, key);
    assert(value, 'redacted smoke command must include ' + key);
    assert(row.includes('warehouse=' + value), label + ' assertion must include ' + key + ' from redacted smoke command');
  }
}

function hasRouteLegEvidence(row) {
  return row.includes('routeLegs=')
    && /local_fulfillment\[available=[1-9]\d*;reservable=yes;/.test(row)
    && row.includes('local_fulfillment')
    && row.includes('customer:warehouse')
    && /supplier_replenishment\[available=[1-9]\d*;reservable=yes;/.test(row)
    && row.includes('supplier_replenishment')
    && row.includes('alfares')
    && /supplier_dropship\[available=[1-9]\d*;reservable=yes;/.test(row)
    && row.includes('supplier_dropship')
    && row.includes('customer:supplier');
}


function hasSupplierOriginEvidence(row) {
  const supplier = row.match(/supplier:[^|;]+:available=[1-9]\d*:supplier=([^;|]+)/)?.[1]?.trim();
  const dropship = row.match(/dropship:[^|;]+:available=[1-9]\d*:supplier=([^;|]+)/)?.[1]?.trim();
  return /own:[^|;]+:available=[1-9]\d*:supplier=-/.test(row)
    && Boolean(supplier && supplier !== '-')
    && Boolean(dropship && dropship !== '-')
    && supplier === dropship;
}

function routeSupplier(row, routeType) {
  const match = row.match(new RegExp(routeType + '\\[[^\\]]*supplier=([^;\\]|]+)'));
  return match?.[1] || null;
}

function hasSupplierRouteOwnershipEvidence(row) {
  const replenishment = routeSupplier(row, 'supplier_replenishment');
  const dropship = routeSupplier(row, 'supplier_dropship');
  return Boolean(replenishment && dropship && replenishment !== '-' && replenishment === dropship);
}

function verify(report) {
  assert(report.includes('- id: VAL-CROSS-STOCK-RUNTIME-LIVE'), 'runtime report id is missing');
  assert(report.includes('- status: passed-runtime'), 'runtime report status must be passed-runtime');
  assert(report.includes('- completeness_level: runtime-complete'), 'runtime report completeness must be runtime-complete');
  assert(report.includes('Runtime complete'), 'completion decision must be Runtime complete');
  assert(!report.includes('missing-runtime'), 'runtime report contains missing-runtime assertions');
  assert(!report.includes('pending-runtime'), 'runtime report contains pending-runtime assertions');
  assert(!report.includes('Runtime incomplete'), 'runtime report is marked incomplete');
  const smokeCommandEvidence = sectionText(report, 'Smoke Command Evidence');
  assert(smokeCommandEvidence.includes('runtime-stock-traceability-smoke.js'), 'smoke command evidence section must include the runtime smoke command');
  const traceProductId = commandEnvValue(smokeCommandEvidence, 'TRACE_PRODUCT_ID');
  const supplierWarehouseId = commandEnvValue(smokeCommandEvidence, 'TRACE_SUPPLIER_WAREHOUSE_ID');
  const dropshipWarehouseId = commandEnvValue(smokeCommandEvidence, 'TRACE_DROPSHIP_WAREHOUSE_ID');

  for (const token of ['CATALOG_TOKEN=[REDACTED]', 'WAREHOUSE_TOKEN=[REDACTED]', 'SUPPLIERS_TOKEN=[REDACTED]']) {
    assert(smokeCommandEvidence.includes(token), `redacted smoke command must include ${token}`);
  }

  for (const requiredFlag of [
    'TRACE_RUN_SUPPLIERS_IMPORT=true',
    'TRACE_EXPECT_SUPPLIERS_JOB=true',
    'OWNER_APPROVAL=explicit',
    'SMOKE_ALLOW_MUTATION=true',
    'TRACE_CLEANUP_EVIDENCE=',
    'RUNTIME_APPROVAL_ARTIFACT_FILE=',
    'TRACE_IMPORT_IDEMPOTENCY_KEY=',
    'TRACE_DROPSHIP_WAREHOUSE_ID=',
    'TRACE_OWN_WAREHOUSE_ID=',
    'TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE-',
  ]) {
    assert(smokeCommandEvidence.includes(requiredFlag), `redacted smoke command must include ${requiredFlag}`);
  }

  assert(report.includes('## Fixture Check Command Evidence'), 'fixture check command evidence section is missing');
  assert(report.includes('--fixture-check'), 'fixture check command must include --fixture-check');
  assert(report.includes('status=fixture-ready'), 'fixture check assertion must include fixture-ready status');
  assert(report.includes('fixtureCheck=yes'), 'fixture check assertion must prove fixtureCheck mode');
  assert(report.includes('mutationEnabled=no'), 'fixture check assertion must prove mutation was disabled');
  assert(report.includes('importTriggered=no'), 'fixture check assertion must prove supplier import was not triggered');

  const passedAssertionCount = countAssertionRows(report);
  assert(passedAssertionCount >= REQUIRED_ASSERTIONS.length, 'runtime report must contain all required passed runtime assertion rows');

  const rows = assertionRows(report);
  for (const assertion of REQUIRED_ASSERTIONS) {
    const row = rows.find((line) => line.startsWith(`| ${assertion} |`));
    assert(row, `required runtime assertion is missing or not passed: ${assertion}`);
    assert(!row.includes('Evidence missing'), `required runtime assertion has missing evidence: ${assertion}`);
    assert(!row.includes('| - |'), `required runtime assertion has placeholder evidence: ${assertion}`);
  }

  const warehouseAvailabilityRow = rows.find((line) => line.startsWith(`| Warehouse availability returns own plus supplier and dropship stock. |`));
  assert(hasSupplierOriginEvidence(warehouseAvailabilityRow), `Warehouse availability assertion must prove own, supplier, and dropship origin rows with positive availability and matching supplier IDs`);

  const warehouseLogisticsRow = rows.find((line) => line.startsWith('| Warehouse logistics returns local, supplier replenishment, and dropship route options. |'));
  assert(hasRouteLegEvidence(warehouseLogisticsRow), 'Warehouse logistics assertion must prove local and supplier route legs');
  assert(hasSupplierRouteOwnershipEvidence(warehouseLogisticsRow), 'Warehouse logistics assertion must prove supplier routes share the same supplier ID');
  assertReportIncludesTraceWarehouseIds(warehouseLogisticsRow, smokeCommandEvidence, 'Warehouse logistics');

  const catalogForwardingRow = rows.find((line) => line.startsWith('| Catalog availability forwards Warehouse origin rows and logistics. |'));
  assert(catalogForwardingRow.includes('source=warehouse'), 'Catalog availability assertion must prove Warehouse source');
  assert(catalogForwardingRow.includes('warehouseCount='), 'Catalog availability assertion must include origin row count');
  assert(catalogForwardingRow.includes('logisticsOptionCount='), 'Catalog availability assertion must include logistics option count');
  assert(catalogForwardingRow.includes('routeTypes=local_fulfillment'), 'Catalog availability assertion must include local route type');
  assert(catalogForwardingRow.includes('supplier_replenishment'), 'Catalog availability assertion must include supplier replenishment route type');
  assert(catalogForwardingRow.includes('supplier_dropship'), 'Catalog availability assertion must include supplier dropship route type');
  assert(hasRouteLegEvidence(catalogForwardingRow), 'Catalog availability assertion must include forwarded local and supplier route legs');
  assert(hasSupplierRouteOwnershipEvidence(catalogForwardingRow), 'Catalog availability assertion must prove supplier routes share the same supplier ID');
  assertReportIncludesTraceWarehouseIds(catalogForwardingRow, smokeCommandEvidence, 'Catalog availability');

  const projectionRow = rows.find((line) => line.startsWith('| FlipFlop projection forwards Warehouse-sourced availability and logistics. |'));
  assert(projectionRow.includes('source=warehouse'), 'FlipFlop projection assertion must prove Warehouse source');
  assert(projectionRow.includes('routeTypes=local_fulfillment'), 'FlipFlop projection assertion must include local route type');
  assert(projectionRow.includes('supplier_replenishment'), 'FlipFlop projection assertion must include supplier replenishment route type');
  assert(projectionRow.includes('supplier_dropship'), 'FlipFlop projection assertion must include supplier dropship route type');
  assert(hasRouteLegEvidence(projectionRow), 'FlipFlop projection assertion must include forwarded local and supplier route legs');
  assert(hasSupplierRouteOwnershipEvidence(projectionRow), 'FlipFlop projection assertion must prove supplier routes share the same supplier ID');
  assertReportIncludesTraceWarehouseIds(projectionRow, smokeCommandEvidence, 'FlipFlop projection');

  const productIdentityRow = rows.find((line) => line.startsWith('| Catalog product identity exists. |'));
  assert(productIdentityRow.includes('expectedSkuPrefix=CODEX-STOCK-TRACE-'), 'Catalog product identity assertion must prove synthetic SKU prefix');
  assert(traceProductId && productIdentityRow.includes('productId=' + traceProductId), 'Catalog product identity assertion must match TRACE_PRODUCT_ID from redacted smoke command');

  const suppliersImportRow = rows.find((line) => line.startsWith('| Suppliers import preserves Catalog identity and Warehouse authority. |'));
  assert(suppliersImportRow.includes('catalogProductValidation=passed'), 'Suppliers import assertion must prove Catalog product validation passed');
  assert(suppliersImportRow.includes('checkedProducts='), 'Suppliers import assertion must include checked Catalog product IDs');
  assert(traceProductId && suppliersImportRow.includes('checkedProducts=' + traceProductId), 'Suppliers import assertion must include TRACE_PRODUCT_ID in checked Catalog product IDs');
  assert(suppliersImportRow.includes('sourceFingerprint=trace:'), 'Suppliers import assertion must include approved import source fingerprint');
  assert(supplierWarehouseId && dropshipWarehouseId && suppliersImportRow.includes('sourceFingerprint=trace:' + traceProductId + ':' + supplierWarehouseId + ':' + dropshipWarehouseId), 'Suppliers import source fingerprint must match TRACE_PRODUCT_ID and supplier warehouse IDs from redacted smoke command');
  assert(suppliersImportRow.includes('authority=warehouse-microservice'), 'Suppliers import assertion must prove Warehouse authority');

  const stockAuthorityRow = rows.find((line) => line.startsWith('| Warehouse remains stock authority across totals. |'));
  assert(stockAuthorityRow.includes('source=warehouse'), 'stock authority assertion must prove Warehouse source');
  for (const field of ['warehouseTotalAvailable=', 'warehouseOriginAvailable=', 'catalogAvailabilityTotal=', 'catalogCoverageTotal=', 'projectionStockQuantity=']) {
    assert(stockAuthorityRow.includes(field), `stock authority assertion must include ${field}`);
  }

  const healthRow = rows.find((line) => line.startsWith('| Warehouse, Catalog, and Suppliers health endpoints passed. |'));
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assert(healthRow.includes(`${service}:`), `health assertion must include ${service} service evidence`);
  }

  for (const service of ['Warehouse', 'Catalog', 'Suppliers']) {
    const line = report.split('\n').find((row) => row.startsWith(`| ${service} |`));
    assert(line, `${service} deployment evidence row is missing`);
    assert(!line.includes('| - |'), `${service} deployment evidence row contains missing values`);
    const cells = rowCells(line);
    assert(/^[0-9a-f]{7,40}$/i.test(cells[1] || ''), `${service} deployment evidence must include a commit SHA`);
    assert(!/TODO/i.test(line), `${service} deployment evidence must not contain TODO placeholders`);
    assert(/401|403/.test(line), `${service} protected endpoint evidence must include 401 or 403`);
    assert(line.includes('./scripts/deploy.sh'), `${service} deployment evidence must include deploy command`);
  }

  return { status: 'passed', assertionRows: passedAssertionCount };
}

try {
  const reportPath = process.env.RUNTIME_EVIDENCE_REPORT || 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md';
  const report = selfTest ? sampleReport() : fs.readFileSync(reportPath, 'utf8');
  console.log(JSON.stringify(verify(report), null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
