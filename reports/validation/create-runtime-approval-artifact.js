#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const outputFile = process.env.RUNTIME_APPROVAL_ARTIFACT_OUTPUT || '/tmp/stock-traceability-runtime-approval.json';
const approvalRequestFile = process.env.RUNTIME_APPROVAL_REQUEST_FILE || '/tmp/stock-traceability-runtime-approval-request-current.md';

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

function assertNoSecrets(value) {
  assert(!/Bearer\s+|CATALOG_TOKEN|WAREHOUSE_TOKEN|SUPPLIERS_TOKEN|SERVICE_TOKEN|api[_-]?key|secret|password/i.test(value), 'runtime approval artifact must not contain token or credential values');
}

function renderArtifact(rows) {
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
    scope: {
      syntheticSkuPrefix: 'CODEX-STOCK-TRACE-',
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
  assert(artifact.scope.syntheticRecordsOnly === true, 'self-test synthetic-only scope missing');
  assert(artifact.scope.oneGuardedSyntheticImport === true, 'self-test guarded import scope missing');
  assert(artifact.scope.ownerApproval === 'explicit', 'self-test owner approval scope missing');
  assert(artifact.forbiddenActionsAcknowledged.includes('token disclosure'), 'self-test forbidden action acknowledgement missing');
}

try {
  if (selfTest) {
    process.env.OWNER_APPROVAL = 'explicit';
    process.env.RUNTIME_APPROVED_BY = 'owner@example.test';
    process.env.RUNTIME_APPROVED_AT = '2026-06-13T00:00:00.000Z';
  }

  assertApprovalEnv();
  const rows = serviceRows();
  assertCleanRows(rows);
  const preflight = runJson(['reports/validation/cross-service-preflight-check.js']);
  assert(preflight.status === 'passed', 'runtime approval artifact requires passing cross-service preflight');
  assert(preflight.completionGate && preflight.completionGate.status === 'incomplete', 'runtime approval artifact must be generated only while completion gate is incomplete');
  assertApprovalRequestMatchesCurrentHeads(rows);
  const { artifact, json } = renderArtifact(rows);
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
    console.log(JSON.stringify({ status: 'passed', services: rows.length, dirtyRowsRejected, missingApprovalRejected }, null, 2));
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
