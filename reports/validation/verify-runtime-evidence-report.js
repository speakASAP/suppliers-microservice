#!/usr/bin/env node
const fs = require('fs');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');

const REQUIRED_ASSERTIONS = [
  'Warehouse, Catalog, and Suppliers health endpoints passed.',
  'Catalog product identity exists.',
  'Warehouse topology distinguishes own and supplier-managed warehouses.',
  'Warehouse availability returns own plus supplier or dropship stock.',
  'Warehouse logistics returns local and supplier route options.',
  'Catalog availability forwards Warehouse origin rows and logistics.',
  'Catalog coverage and audit classify covered mixed stock.',
  'FlipFlop projection forwards Warehouse-sourced availability and logistics.',
  'Suppliers import preserves Warehouse authority.',
  'Cleanup or archival evidence is recorded.',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

## Deployment Evidence

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | sha-warehouse | ./scripts/deploy.sh | /api/health passed | anonymous topology returned 401 |
| Catalog | sha-catalog | ./scripts/deploy.sh | /health passed | anonymous coverage returned 401 |
| Suppliers | sha-suppliers | ./scripts/deploy.sh | /api/health passed | anonymous imports returned 401 |

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
| Warehouse, Catalog, and Suppliers health endpoints passed. | service-1: ok; service-2: ok; service-3: ok | passed-runtime |
| Catalog product identity exists. | productId=product-synthetic, sku=CODEX-STOCK-TRACE-001 | passed-runtime |
| Warehouse topology distinguishes own and supplier-managed warehouses. | own=1, supplierManaged=1 | passed-runtime |
| Warehouse availability returns own plus supplier or dropship stock. | own and dropship rows | passed-runtime |
| Warehouse logistics returns local and supplier route options. | routes=local_fulfillment,supplier_dropship | passed-runtime |
| Catalog availability forwards Warehouse origin rows and logistics. | source=warehouse, warehouseCount=2, logisticsOptionCount=2, preferredRoute=local_fulfillment | passed-runtime |
| Catalog coverage and audit classify covered mixed stock. | covered/mixed_stock | passed-runtime |
| FlipFlop projection forwards Warehouse-sourced availability and logistics. | productId=product-synthetic, source=warehouse, routeCount=2 | passed-runtime |
| Suppliers import preserves Warehouse authority. | authority=warehouse-microservice | passed-runtime |
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

function verify(report) {
  assert(report.includes('- id: VAL-CROSS-STOCK-RUNTIME-LIVE'), 'runtime report id is missing');
  assert(report.includes('- status: passed-runtime'), 'runtime report status must be passed-runtime');
  assert(report.includes('- completeness_level: runtime-complete'), 'runtime report completeness must be runtime-complete');
  assert(report.includes('Runtime complete'), 'completion decision must be Runtime complete');
  assert(!report.includes('missing-runtime'), 'runtime report contains missing-runtime assertions');
  assert(!report.includes('pending-runtime'), 'runtime report contains pending-runtime assertions');
  assert(!report.includes('Runtime incomplete'), 'runtime report is marked incomplete');
  assert(!report.includes('[REDACTED]') || report.includes('CATALOG_TOKEN=[REDACTED]'), 'redacted token marker must only appear in command evidence');

  const passedAssertionCount = countAssertionRows(report);
  assert(passedAssertionCount >= REQUIRED_ASSERTIONS.length, 'runtime report must contain all required passed runtime assertion rows');

  const rows = assertionRows(report);
  for (const assertion of REQUIRED_ASSERTIONS) {
    const row = rows.find((line) => line.startsWith(`| ${assertion} |`));
    assert(row, `required runtime assertion is missing or not passed: ${assertion}`);
    assert(!row.includes('Evidence missing'), `required runtime assertion has missing evidence: ${assertion}`);
    assert(!row.includes('| - |'), `required runtime assertion has placeholder evidence: ${assertion}`);
  }

  const catalogForwardingRow = rows.find((line) => line.startsWith('| Catalog availability forwards Warehouse origin rows and logistics. |'));
  assert(catalogForwardingRow.includes('source=warehouse'), 'Catalog availability assertion must prove Warehouse source');
  assert(catalogForwardingRow.includes('warehouseCount='), 'Catalog availability assertion must include origin row count');
  assert(catalogForwardingRow.includes('logisticsOptionCount='), 'Catalog availability assertion must include logistics option count');

  const projectionRow = rows.find((line) => line.startsWith('| FlipFlop projection forwards Warehouse-sourced availability and logistics. |'));
  assert(projectionRow.includes('source=warehouse'), 'FlipFlop projection assertion must prove Warehouse source');

  for (const service of ['Warehouse', 'Catalog', 'Suppliers']) {
    const line = report.split('\n').find((row) => row.startsWith(`| ${service} |`));
    assert(line, `${service} deployment evidence row is missing`);
    assert(!line.includes('| - |'), `${service} deployment evidence row contains missing values`);
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
