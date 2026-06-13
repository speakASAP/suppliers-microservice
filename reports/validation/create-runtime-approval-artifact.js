#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const outputFile = process.env.RUNTIME_APPROVAL_ARTIFACT_OUTPUT || '/tmp/stock-traceability-runtime-approval.json';
const approvalRequestFile = process.env.RUNTIME_APPROVAL_REQUEST_FILE || '/tmp/stock-traceability-runtime-approval-request-current.md';
const readinessManifestFile = process.env.RUNTIME_READINESS_MANIFEST_FILE || '/tmp/stock-traceability-runtime-readiness/stock-traceability-runtime-readiness-manifest.json';

const requiredTraceInputEnv = [
  'TRACE_PRODUCT_ID',
  'TRACE_PRODUCT_SKU_PREFIX',
  'TRACE_SUPPLIER_ID',
  'TRACE_OWN_WAREHOUSE_ID',
  'TRACE_SUPPLIER_WAREHOUSE_ID',
  'TRACE_DROPSHIP_WAREHOUSE_ID',
  'TRACE_IMPORT_IDEMPOTENCY_KEY',
  'TRACE_SUPPLIER_STOCK_QTY',
  'TRACE_SUPPLIER_SKU',
];

const services = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

const forbiddenActionsAcknowledged = [
  'real supplier imports',
  'production payload ingestion',
  'customer data capture',
  'hard deletes',
  'compensating stock changes',
  'token disclosure',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function envValue(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : '';
}

function git(repo, gitArgs) {
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === 'HEAD') return repo.slice(0, 3).padEnd(40, '0');
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === '--abbrev-ref') return 'self-test-branch';
  if (selfTest && gitArgs[0] === 'status') return '';
  return execFileSync('git', gitArgs, { cwd: path.join(root, repo), encoding: 'utf8' }).trim();
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
  assert(dirty.length === 0, 'runtime approval artifact requires clean Warehouse, Catalog, and Suppliers worktrees; dirty services: ' + dirty.map((row) => row.repo).join(', '));
}

function runJson(commandArgs) {
  if (selfTest) {
    return {
      status: 'passed',
      completionGate: { status: 'incomplete', result: { reason: 'runtime report is not passed-runtime/runtime-complete' } },
    };
  }
  const result = spawnSync(process.execPath, commandArgs, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(commandArgs.join(' ') + ' failed: ' + (result.stdout + result.stderr).trim());
  return JSON.parse(result.stdout);
}

function assertApprovalRequestMatchesCurrentHeads(rows) {
  if (selfTest) return;
  assert(fs.existsSync(approvalRequestFile), 'RUNTIME_APPROVAL_REQUEST_FILE does not exist: ' + approvalRequestFile);
  const markdown = fs.readFileSync(approvalRequestFile, 'utf8');
  assert(markdown.includes('STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST'), 'approval request file must be the generated stock traceability request');
  for (const row of rows) {
    assert(markdown.includes(row.head), 'approval request file does not contain current ' + row.name + ' head ' + row.head);
  }
}

function assertApprovalEnv() {
  assert(process.env.OWNER_APPROVAL === 'explicit', 'OWNER_APPROVAL=explicit is required to generate runtime approval artifact');
  assert(envValue('RUNTIME_APPROVED_BY'), 'RUNTIME_APPROVED_BY is required to generate runtime approval artifact');
}

function traceInputsFromEnv() {
  const missing = requiredTraceInputEnv.filter((name) => !envValue(name));
  assert(missing.length === 0, 'runtime approval artifact requires approved trace inputs: ' + missing.join(', '));
  assert(envValue('TRACE_PRODUCT_SKU_PREFIX') === 'CODEX-STOCK-TRACE-', 'TRACE_PRODUCT_SKU_PREFIX must be CODEX-STOCK-TRACE- for runtime approval');
  assert(/^\d+$/.test(envValue('TRACE_SUPPLIER_STOCK_QTY')) && Number(envValue('TRACE_SUPPLIER_STOCK_QTY')) > 0, 'TRACE_SUPPLIER_STOCK_QTY must be a positive integer string');
  return Object.fromEntries(requiredTraceInputEnv.map((name) => [name, envValue(name)]));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function verifyReadinessManifest(rows) {
  if (selfTest) {
    return {
      file: '/tmp/self-test-readiness-manifest.json',
      sha256: '0'.repeat(64),
      status: 'verified',
      serviceHeads: Object.fromEntries(rows.map((row) => [row.name, row.head])),
    };
  }
  assert(fs.existsSync(readinessManifestFile), 'RUNTIME_READINESS_MANIFEST_FILE does not exist: ' + readinessManifestFile);
  const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-readiness-bundle.js', readinessManifestFile], {
    cwd: process.cwd(),
    env: { ...process.env, CROSS_SERVICE_ROOT: root },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('runtime readiness manifest failed verifier: ' + (result.stdout + result.stderr).trim());
  const parsed = JSON.parse(result.stdout);
  assert(parsed.status === 'verified', 'runtime readiness manifest must verify before approval artifact generation');
  const manifest = JSON.parse(fs.readFileSync(readinessManifestFile, 'utf8'));
  for (const row of rows) {
    assert(manifest.serviceHeads && manifest.serviceHeads[row.name] === row.head, 'runtime readiness manifest does not contain current ' + row.name + ' head ' + row.head);
  }
  return {
    file: readinessManifestFile,
    sha256: sha256File(readinessManifestFile),
    status: parsed.status,
    serviceHeads: manifest.serviceHeads,
  };
}

function assertNoSecrets(value) {
  assert(!/Bearer\s+|CATALOG_TOKEN|WAREHOUSE_TOKEN|SUPPLIERS_TOKEN|SERVICE_TOKEN|api[_-]?key|secret|password/i.test(value), 'runtime approval artifact must not contain token or credential values');
}

function renderArtifact(rows, readinessManifest, approvedTraceInputs) {
  const serviceHeads = Object.fromEntries(rows.map((row) => [row.name, row.head]));
  const approvedBy = envValue('RUNTIME_APPROVED_BY');
  const approvedAt = envValue('RUNTIME_APPROVED_AT') || new Date().toISOString();
  const artifact = {
    id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL',
    status: 'approved',
    approvalRequestId: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    approvedBy,
    approvedAt,
    approvedForCurrentCleanHeads: true,
    serviceHeads,
    readinessManifest,
    approvedTraceInputs,
    scope: {
      syntheticSkuPrefix: approvedTraceInputs.TRACE_PRODUCT_SKU_PREFIX,
      syntheticRecordsOnly: true,
      oneGuardedSyntheticImport: true,
      runApprovedRuntimeSmoke: true,
      ownerApproval: 'explicit',
      smokeAllowMutation: true,
    },
    forbiddenActionsAcknowledged,
  };
  const json = JSON.stringify(artifact, null, 2) + '\n';
  assertNoSecrets(json);
  return { artifact, json };
}

function validateWithVerifier(filePath) {
  if (selfTest) return;
  const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-approval-artifact.js', filePath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('generated runtime approval artifact failed verifier: ' + (result.stdout + result.stderr).trim());
}

function assertSelfTestContent(artifact) {
  assert(artifact.id === 'STOCK-TRACEABILITY-RUNTIME-APPROVAL', 'self-test id mismatch');
  assert(artifact.status === 'approved', 'self-test status mismatch');
  assert(artifact.approvalRequestId === 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', 'self-test approval request id mismatch');
  assert(artifact.approvedForCurrentCleanHeads === true, 'self-test current head marker missing');
  assert(artifact.readinessManifest && artifact.readinessManifest.status === 'verified', 'self-test readiness manifest binding missing');
  assert(artifact.scope.syntheticRecordsOnly === true, 'self-test synthetic-only scope missing');
  assert(artifact.scope.oneGuardedSyntheticImport === true, 'self-test guarded import scope missing');
  assert(artifact.scope.ownerApproval === 'explicit', 'self-test owner approval scope missing');
  assert(artifact.approvedTraceInputs && artifact.approvedTraceInputs.TRACE_SUPPLIER_STOCK_QTY === '7', 'self-test approved trace inputs missing');
  assert(artifact.forbiddenActionsAcknowledged.includes('token disclosure'), 'self-test forbidden action acknowledgement missing');
}

try {
  if (selfTest) {
    process.env.OWNER_APPROVAL = 'explicit';
    process.env.RUNTIME_APPROVED_BY = 'owner@example.test';
    process.env.RUNTIME_APPROVED_AT = '2026-06-13T00:00:00.000Z';
    process.env.TRACE_PRODUCT_ID = 'product-synthetic';
    process.env.TRACE_PRODUCT_SKU_PREFIX = 'CODEX-STOCK-TRACE-';
    process.env.TRACE_SUPPLIER_ID = 'supplier-synthetic';
    process.env.TRACE_OWN_WAREHOUSE_ID = 'warehouse-own';
    process.env.TRACE_SUPPLIER_WAREHOUSE_ID = 'warehouse-supplier';
    process.env.TRACE_DROPSHIP_WAREHOUSE_ID = 'warehouse-dropship';
    process.env.TRACE_IMPORT_IDEMPOTENCY_KEY = 'manual:traceability-synthetic';
    process.env.TRACE_SUPPLIER_STOCK_QTY = '7';
    process.env.TRACE_SUPPLIER_SKU = 'SUP-SKU-TRACE';
  }

  assertApprovalEnv();
  const approvedTraceInputs = traceInputsFromEnv();
  const rows = serviceRows();
  assertCleanRows(rows);
  const preflight = runJson(['reports/validation/cross-service-preflight-check.js']);
  assert(preflight.status === 'passed', 'runtime approval artifact requires passing cross-service preflight');
  assert(preflight.completionGate && preflight.completionGate.status === 'incomplete', 'runtime approval artifact must be generated only while completion gate is incomplete');
  assertApprovalRequestMatchesCurrentHeads(rows);
  const readinessManifest = verifyReadinessManifest(rows);
  const { artifact, json } = renderArtifact(rows, readinessManifest, approvedTraceInputs);
  assertSelfTestContent(artifact);

  if (selfTest) {
    const dirtyRows = rows.map((row, index) => index === 2 ? { ...row, dirtyLines: 1 } : row);
    let dirtyRowsRejected = false;
    try {
      assertCleanRows(dirtyRows);
    } catch (error) {
      dirtyRowsRejected = /requires clean/.test(error.message);
    }
    let missingApprovalRejected = false;
    const previousApproval = process.env.OWNER_APPROVAL;
    process.env.OWNER_APPROVAL = '';
    try {
      assertApprovalEnv();
    } catch (error) {
      missingApprovalRejected = /OWNER_APPROVAL=explicit/.test(error.message);
    }
    process.env.OWNER_APPROVAL = previousApproval;
    assert(dirtyRowsRejected, 'approval artifact self-test must reject dirty source snapshots');
    assert(missingApprovalRejected, 'approval artifact self-test must reject missing explicit owner approval');
    const previousQty = process.env.TRACE_SUPPLIER_STOCK_QTY;
    process.env.TRACE_SUPPLIER_STOCK_QTY = '';
    let missingTraceInputRejected = false;
    try {
      traceInputsFromEnv();
    } catch (error) {
      missingTraceInputRejected = /approved trace inputs/.test(error.message);
    }
    process.env.TRACE_SUPPLIER_STOCK_QTY = previousQty;
    assert(missingTraceInputRejected, 'approval artifact self-test must reject missing approved trace inputs');
    console.log(JSON.stringify({ status: 'passed', services: rows.length, dirtyRowsRejected, missingApprovalRejected, missingTraceInputRejected, readinessManifestBound: true }, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, json);
    validateWithVerifier(outputFile);
    console.log(JSON.stringify({ status: 'written', outputFile, services: rows.length, approvedBy: artifact.approvedBy, completionGate: preflight.completionGate.status }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
