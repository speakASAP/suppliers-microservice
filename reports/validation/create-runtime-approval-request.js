#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const outputFile = process.env.RUNTIME_APPROVAL_REQUEST_OUTPUT || '/tmp/stock-traceability-runtime-approval-request.md';
const services = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(repo, gitArgs) {
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === 'HEAD') return repo.slice(0, 3).padEnd(40, '0');
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === '--abbrev-ref') return 'self-test-branch';
  if (selfTest && gitArgs[0] === 'status') return '';
  return execFileSync('git', gitArgs, { cwd: path.join(root, repo), encoding: 'utf8' }).trim();
}

function runJson(commandArgs) {
  if (selfTest) {
    return {
      status: 'passed',
      liveRuntimeReport: { status: 'not-passed-runtime' },
      completionGate: { status: 'incomplete', result: { reason: 'runtime report is not passed-runtime/runtime-complete' } },
    };
  }
  const result = spawnSync(process.execPath, commandArgs, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(commandArgs.join(' ') + ' failed: ' + (result.stdout + result.stderr).trim());
  return JSON.parse(result.stdout);
}

function serviceRows() {
  return Object.entries(services).map(([name, repo]) => {
    const status = git(repo, ['status', '--short']);
    return {
      name,
      repo,
      branch: git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']),
      head: git(repo, ['rev-parse', 'HEAD']),
      dirtyLines: status ? status.split('\n').length : 0,
    };
  });
}

function assertCleanRows(rows) {
  const dirty = rows.filter((row) => row.dirtyLines !== 0);
  assert(dirty.length === 0, 'runtime approval request requires clean Warehouse, Catalog, and Suppliers worktrees; dirty services: ' + dirty.map((row) => row.repo).join(', '));
}

function shortHead(head) {
  return String(head || '').slice(0, 7);
}

function oneLine(value) {
  return String(value || '-').replace(/\s+/g, ' ').trim();
}

function render(rows, preflight) {
  const table = rows.map((row) => '| ' + row.name + ' | ' + row.repo + ' | ' + row.branch + ' | ' + row.head + ' | ' + row.dirtyLines + ' |').join('\n');
  const heads = Object.fromEntries(rows.map((row) => [row.name, shortHead(row.head)]));
  const reason = oneLine(preflight.completionGate && preflight.completionGate.result && preflight.completionGate.result.reason);
  return [
    '# Stock Traceability Runtime Approval Request',
    '',
    'Metadata:',
    '- id: STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    '- status: ready-for-owner-approval',
    '- generatedAt: ' + new Date().toISOString(),
    '- preflightStatus: ' + (preflight.status || 'unknown'),
    '- liveRuntimeReport: ' + ((preflight.liveRuntimeReport && preflight.liveRuntimeReport.status) || 'unknown'),
    '- completionGate: ' + ((preflight.completionGate && preflight.completionGate.status) || 'unknown'),
    '- completionReason: ' + reason,
    '',
    '## Approval Request',
    '',
    'Approve exactly these three actions for the current clean heads only:',
    '',
    '1. Deploy Warehouse ' + heads.warehouse + ', Catalog ' + heads.catalog + ', and Suppliers ' + heads.suppliers + ' in that order.',
    '2. Create or reuse only synthetic traceability records with the CODEX-STOCK-TRACE- SKU prefix.',
    '3. Run one guarded Suppliers synthetic import with RUN_APPROVED_RUNTIME_SMOKE=true, OWNER_APPROVAL=explicit, and SMOKE_ALLOW_MUTATION=true so Warehouse supplier and dropship stock can be reconciled for the approved trace product.',
    '',
    'The owner approval must name the exact approvedTraceInputs before mutation: TRACE_PRODUCT_ID, TRACE_PRODUCT_SKU_PREFIX, TRACE_SUPPLIER_ID, TRACE_OWN_WAREHOUSE_ID, TRACE_SUPPLIER_WAREHOUSE_ID, TRACE_DROPSHIP_WAREHOUSE_ID, TRACE_IMPORT_IDEMPOTENCY_KEY, TRACE_SUPPLIER_STOCK_QTY, TRACE_SUPPLIER_SKU, and TRACE_CLEANUP_EVIDENCE.',
    '',
    'TRACE_CLEANUP_EVIDENCE must be a completed cleanup record or an explicit owner-approved deferral reference. Hard deletes and compensating stock changes remain forbidden unless separately approved.',
    '',
    'Do not approve real supplier imports, production payload ingestion, customer data capture, hard deletes, compensating stock changes, or token disclosure as part of this approval.',
    '',
    '## Current Source Snapshot',
    '',
    '| Service | Repository | Branch | HEAD | Dirty lines |',
    '| --- | --- | --- | --- | --- |',
    table,
    '',
    '## Required Runtime Evidence',
    '',
    '- read-only fixture check passes before mutation;',
    '- Warehouse shows own, supplier replenishment, and dropship origins for the approved trace product;',
    '- Warehouse, Catalog, and FlipFlop expose positive reservable local, supplier replenishment, and dropship route legs whose warehouse and supplier IDs match the approved trace command;',
    '- Fixture and approved smoke commands use the same TRACE_PRODUCT_ID, TRACE_PRODUCT_SKU_PREFIX, TRACE_OWN_WAREHOUSE_ID, TRACE_SUPPLIER_WAREHOUSE_ID, and TRACE_DROPSHIP_WAREHOUSE_ID;',
    '- Suppliers import job belongs to TRACE_SUPPLIER_ID, validates the Catalog product ID, preserves Warehouse authority, records owner-approved mutation, reports positive applied updates, and has a source fingerprint matching TRACE_PRODUCT_ID, TRACE_SUPPLIER_WAREHOUSE_ID, TRACE_DROPSHIP_WAREHOUSE_ID, TRACE_SUPPLIER_STOCK_QTY, and TRACE_SUPPLIER_SKU;',
    '- approved smoke evidence uses the same TRACE_CLEANUP_EVIDENCE that the owner approved before mutation;',
    '- final report, manifest, and bundle verifier pass verify-stock-traceability-completion.js.',
    '',
    '## Operator Artifacts To Regenerate After Approval',
    '',
    '- /tmp/stock-traceability-runtime-readiness/stock-traceability-runtime-readiness-manifest.json',
    '- /tmp/stock-traceability-runtime-approval.json generated with RUNTIME_READINESS_MANIFEST_FILE and verified by verify-runtime-approval-artifact.js',
    '- /tmp/stock-traceability-deployment-evidence-current.template.json',
    '- /tmp/stock-traceability-runtime-handoff-current.md',
    '- /tmp/stock-traceability-runtime/stock-traceability-runtime-evidence-manifest.json',
    '- docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md',
    '',
    '## Non-Completion Reminder',
    '',
    'This approval request is not completion evidence. Completion remains incomplete until the guarded runtime evidence flow returns runtime-complete and verify-stock-traceability-completion.js returns complete for the generated report and manifest.',
    '',
  ].join('\n');
}

function assertSelfTestContent(markdown) {
  const required = [
    'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    'Approve exactly these three actions',
    'Deploy Warehouse',
    'CODEX-STOCK-TRACE-',
    'RUN_APPROVED_RUNTIME_SMOKE=true',
    'OWNER_APPROVAL=explicit',
    'SMOKE_ALLOW_MUTATION=true',
    'stock-traceability-runtime-readiness-manifest.json',
    'RUNTIME_READINESS_MANIFEST_FILE',
    'verify-runtime-approval-artifact.js',
    'warehouse and supplier IDs match the approved trace command',
    'Fixture and approved smoke commands use the same TRACE_PRODUCT_ID',
    'exact approvedTraceInputs before mutation',
    'TRACE_CLEANUP_EVIDENCE must be a completed cleanup record or an explicit owner-approved deferral reference',
    'source fingerprint matching TRACE_PRODUCT_ID, TRACE_SUPPLIER_WAREHOUSE_ID, TRACE_DROPSHIP_WAREHOUSE_ID, TRACE_SUPPLIER_STOCK_QTY, and TRACE_SUPPLIER_SKU',
    'Suppliers import job belongs to TRACE_SUPPLIER_ID',
    'verify-stock-traceability-completion.js',
    'This approval request is not completion evidence',
  ];
  const missing = required.filter((pattern) => !markdown.includes(pattern));
  assert(missing.length === 0, 'approval request missing required content: ' + missing.join(', '));
  assert(!/Bearer\s+|catalog-token-synthetic|warehouse-token-synthetic|suppliers-token-synthetic/i.test(markdown), 'approval request must not render token values');
}

try {
  const rows = serviceRows();
  assertCleanRows(rows);
  const preflight = runJson(['reports/validation/cross-service-preflight-check.js']);
  assert(preflight.status === 'passed', 'approval request requires passing cross-service preflight');
  assert(preflight.completionGate && preflight.completionGate.status === 'incomplete', 'approval request must be generated only while completion gate is incomplete');
  const markdown = render(rows, preflight);
  assertSelfTestContent(markdown);
  if (selfTest) {
    const dirtyRows = rows.map((row, index) => index === 1 ? { ...row, dirtyLines: 1 } : row);
    let dirtyRowsRejected = false;
    try {
      assertCleanRows(dirtyRows);
    } catch (error) {
      dirtyRowsRejected = /requires clean/.test(error.message);
    }
    assert(dirtyRowsRejected, 'approval request self-test must reject dirty source snapshots');
    console.log(JSON.stringify({ status: 'passed', services: rows.length, dirtyRowsRejected }, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, markdown);
    console.log(JSON.stringify({ status: 'written', outputFile, services: rows.length, completionGate: preflight.completionGate.status }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
