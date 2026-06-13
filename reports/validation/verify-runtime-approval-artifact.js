#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const fileArg = args.find((arg) => arg !== '--self-test');
let crossServiceRoot = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';

const deploymentRepos = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

const requiredTraceInputKeys = [
  'TRACE_PRODUCT_ID',
  'TRACE_PRODUCT_SKU_PREFIX',
  'TRACE_SUPPLIER_ID',
  'TRACE_OWN_WAREHOUSE_ID',
  'TRACE_SUPPLIER_WAREHOUSE_ID',
  'TRACE_DROPSHIP_WAREHOUSE_ID',
  'TRACE_IMPORT_IDEMPOTENCY_KEY',
  'TRACE_SUPPLIER_STOCK_QTY',
  'TRACE_SUPPLIER_SKU',
  'TRACE_CLEANUP_EVIDENCE',
];

const requiredForbiddenActions = [
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

function repoPathForService(service) {
  const repo = deploymentRepos[service];
  assert(repo, `Unknown deployment service: ${service}`);
  const repoPath = path.join(crossServiceRoot, repo);
  assert(fs.existsSync(repoPath), `Repository not found for ${service}: ${repoPath}`);
  return repoPath;
}

function currentHeadForService(service) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPathForService(service), encoding: 'utf8' }).trim();
}

function assertCleanWorktreeForService(service) {
  const status = execFileSync('git', ['status', '--short'], { cwd: repoPathForService(service), encoding: 'utf8' }).trim();
  assert(!status, `${deploymentRepos[service]} worktree must be clean before runtime approval can authorize mutation`);
}

function readJsonFile(filePath) {
  assert(filePath, 'RUNTIME_APPROVAL_ARTIFACT_FILE is required for approved runtime smoke');
  assert(fs.existsSync(filePath), `RUNTIME_APPROVAL_ARTIFACT_FILE does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`RUNTIME_APPROVAL_ARTIFACT_FILE is not valid JSON: ${error.message}`);
  }
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertTraceInputs(artifact) {
  const inputs = artifact.approvedTraceInputs || {};
  const missing = requiredTraceInputKeys.filter((key) => !hasText(inputs[key]));
  assert(missing.length === 0, 'approval artifact approvedTraceInputs missing: ' + missing.join(', '));
  assert(inputs.TRACE_PRODUCT_SKU_PREFIX === 'CODEX-STOCK-TRACE-', 'approval artifact approvedTraceInputs.TRACE_PRODUCT_SKU_PREFIX must be CODEX-STOCK-TRACE-');
  assert(/^\d+$/.test(inputs.TRACE_SUPPLIER_STOCK_QTY) && Number(inputs.TRACE_SUPPLIER_STOCK_QTY) > 0, 'approval artifact approvedTraceInputs.TRACE_SUPPLIER_STOCK_QTY must be a positive integer string');
  assert(!/TODO/i.test(inputs.TRACE_CLEANUP_EVIDENCE), 'approval artifact approvedTraceInputs.TRACE_CLEANUP_EVIDENCE must be completed or explicitly deferred and must not contain TODO');
  assert(!Object.values(inputs).some((value) => /Bearer\s+|TOKEN=|api[_-]?key|secret|password/i.test(String(value))), 'approval artifact approvedTraceInputs must not contain secrets');
}

function assertNoSecrets(artifactText) {
  assert(!/Bearer\s+|CATALOG_TOKEN|WAREHOUSE_TOKEN|SUPPLIERS_TOKEN|SERVICE_TOKEN|api[_-]?key|secret|password/i.test(artifactText), 'runtime approval artifact must not contain token or credential values');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertApprovalRequestBinding(artifact, artifactDir) {
  const request = artifact.approvalRequest;
  assert(request && typeof request === 'object', 'approval artifact approvalRequest binding is required');
  assert(request.id === 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', 'approval artifact approvalRequest.id must be STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST');
  assert(hasText(request.file), 'approval artifact approvalRequest.file is required');
  assert(/^[0-9a-f]{64}$/i.test(request.sha256 || ''), 'approval artifact approvalRequest.sha256 must be a 64-character hex digest');
  const requestFile = path.isAbsolute(request.file) ? request.file : path.join(artifactDir, request.file);
  assert(fs.existsSync(requestFile), 'approval artifact approvalRequest.file does not exist: ' + request.file);
  assert(sha256File(requestFile) === request.sha256, 'approval artifact approvalRequest.sha256 must match approval request file');
  const requestText = fs.readFileSync(requestFile, 'utf8');
  assertNoSecrets(requestText);
  assert(requestText.includes('STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST'), 'approval artifact approvalRequest file must include request id');
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assert(request.serviceHeads && request.serviceHeads[service] === artifact.serviceHeads?.[service], `approval artifact approvalRequest ${service} head must match approval serviceHeads`);
    assert(requestText.includes(artifact.serviceHeads?.[service] || ''), `approval artifact approvalRequest file must include ${service} service head`);
  }
}

function assertReadinessManifestBinding(artifact, artifactDir) {
  const readiness = artifact.readinessManifest;
  assert(readiness && typeof readiness === 'object', 'approval artifact readinessManifest binding is required');
  assert(readiness.status === 'verified', 'approval artifact readinessManifest.status must be verified');
  assert(hasText(readiness.file), 'approval artifact readinessManifest.file is required');
  assert(/^[0-9a-f]{64}$/i.test(readiness.sha256 || ''), 'approval artifact readinessManifest.sha256 must be a 64-character hex digest');
  const readinessFile = path.isAbsolute(readiness.file) ? readiness.file : path.join(artifactDir, readiness.file);
  assert(fs.existsSync(readinessFile), 'approval artifact readinessManifest.file does not exist: ' + readiness.file);
  assert(sha256File(readinessFile) === readiness.sha256, 'approval artifact readinessManifest.sha256 must match readiness manifest file');
  if (!selfTest) {
    const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-readiness-bundle.js', readinessFile], {
      cwd: process.cwd(),
      env: { ...process.env, CROSS_SERVICE_ROOT: crossServiceRoot },
      encoding: 'utf8',
    });
    assert(result.status === 0, 'approval artifact readiness manifest must pass verify-runtime-readiness-bundle.js: ' + (result.stdout + result.stderr).trim());
    const verified = JSON.parse(result.stdout);
    assert(verified.status === 'verified', 'approval artifact readiness manifest verifier must return verified');
  }
  const readinessJson = JSON.parse(fs.readFileSync(readinessFile, 'utf8'));
  assert(readinessJson.status === 'ready-for-owner-approval', 'approval artifact readiness manifest must be ready-for-owner-approval');
  const readinessApprovalRequest = readinessJson.artifacts && readinessJson.artifacts.approvalRequest;
  assert(readinessApprovalRequest && readinessApprovalRequest.sha256 === artifact.approvalRequest?.sha256, 'approval artifact approvalRequest must match readiness manifest approvalRequest artifact');
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assert(readiness.serviceHeads && readiness.serviceHeads[service] === artifact.serviceHeads?.[service], `approval artifact readinessManifest ${service} head must match approval serviceHeads`);
    assert(readinessJson.serviceHeads && readinessJson.serviceHeads[service] === artifact.serviceHeads?.[service], `approval artifact readiness manifest file ${service} head must match approval serviceHeads`);
  }
}

function forbiddenActionText(artifact) {
  if (Array.isArray(artifact.forbiddenActionsAcknowledged)) return artifact.forbiddenActionsAcknowledged.join('\n');
  if (Array.isArray(artifact.forbiddenActions)) return artifact.forbiddenActions.join('\n');
  return String(artifact.forbiddenActionsAcknowledged || artifact.forbiddenActions || '');
}

function validateApprovalArtifact(filePath) {
  const artifactText = fs.readFileSync(filePath, 'utf8');
  assertNoSecrets(artifactText);
  const artifact = readJsonFile(filePath);
  assert(artifact.id === 'STOCK-TRACEABILITY-RUNTIME-APPROVAL', 'approval artifact id must be STOCK-TRACEABILITY-RUNTIME-APPROVAL');
  assert(artifact.status === 'approved', 'approval artifact status must be approved');
  assert(artifact.approvalRequestId === 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', 'approval artifact must reference STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST');
  assert(hasText(artifact.approvedBy), 'approval artifact approvedBy is required');
  assert(isIsoDate(artifact.approvedAt), 'approval artifact approvedAt must be an ISO timestamp');
  assert(artifact.approvedForCurrentCleanHeads === true, 'approval artifact must set approvedForCurrentCleanHeads=true');

  assertApprovalRequestBinding(artifact, path.dirname(filePath));
  assertReadinessManifestBinding(artifact, path.dirname(filePath));

  const scope = artifact.scope || {};
  assert(scope.syntheticSkuPrefix === 'CODEX-STOCK-TRACE-', 'approval artifact scope.syntheticSkuPrefix must be CODEX-STOCK-TRACE-');
  assert(scope.syntheticRecordsOnly === true, 'approval artifact scope.syntheticRecordsOnly must be true');
  assert(scope.oneGuardedSyntheticImport === true, 'approval artifact scope.oneGuardedSyntheticImport must be true');
  assert(scope.runApprovedRuntimeSmoke === true, 'approval artifact scope.runApprovedRuntimeSmoke must be true');
  assert(scope.ownerApproval === 'explicit', 'approval artifact scope.ownerApproval must be explicit');
  assert(scope.smokeAllowMutation === true, 'approval artifact scope.smokeAllowMutation must be true');
  assertTraceInputs(artifact);

  const forbidden = forbiddenActionText(artifact).toLowerCase();
  const missingForbidden = requiredForbiddenActions.filter((action) => !forbidden.includes(action));
  assert(missingForbidden.length === 0, 'approval artifact must acknowledge forbidden actions: ' + missingForbidden.join(', '));

  const serviceHeads = artifact.serviceHeads || {};
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assertCleanWorktreeForService(service);
    const currentHead = currentHeadForService(service);
    assert(serviceHeads[service] === currentHead, `approval artifact ${service} head must match current ${deploymentRepos[service]} HEAD ${currentHead}`);
  }

  return artifact;
}

function git(repoPath, gitArgs) {
  return execFileSync('git', gitArgs, { cwd: repoPath, encoding: 'utf8' }).trim();
}

function initSelfTestRepo(root, repo) {
  const repoPath = path.join(root, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# ' + repo + '\n');
  git(repoPath, ['init']);
  git(repoPath, ['add', 'README.md']);
  git(repoPath, ['-c', 'user.email=codex@example.invalid', '-c', 'user.name=Codex', 'commit', '-m', 'self-test repo']);
  return repoPath;
}

function validArtifactForRoot(root, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-readiness-binding-'))) {
  const previousRoot = crossServiceRoot;
  crossServiceRoot = root;
  const serviceHeads = {
      warehouse: currentHeadForService('warehouse'),
      catalog: currentHeadForService('catalog'),
      suppliers: currentHeadForService('suppliers'),
    };
  const approvalRequest = writeApprovalRequest(dir, serviceHeads);
  const artifact = {
    id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL',
    status: 'approved',
    approvalRequestId: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    approvalRequest,
    approvedBy: 'owner@example.test',
    approvedAt: new Date().toISOString(),
    approvedForCurrentCleanHeads: true,
    serviceHeads: { ...serviceHeads },
    readinessManifest: writeReadinessManifest(dir, serviceHeads, approvalRequest),
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
    forbiddenActionsAcknowledged: requiredForbiddenActions,
  };
  crossServiceRoot = previousRoot;
  return artifact;
}

function writeApprovalRequest(dir, serviceHeads) {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'runtime-approval-request.md');
  const heads = Object.entries(serviceHeads).map(([service, head]) => service + ':' + head).join('\n');
  fs.writeFileSync(filePath, 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST\n' + heads + '\napprovedTraceInputs TRACE_PRODUCT_ID TRACE_SUPPLIER_ID TRACE_IMPORT_IDEMPOTENCY_KEY TRACE_SUPPLIER_STOCK_QTY TRACE_SUPPLIER_SKU TRACE_CLEANUP_EVIDENCE\n');
  return { id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', file: filePath, bytes: fs.statSync(filePath).size, sha256: sha256File(filePath), serviceHeads: { ...serviceHeads } };
}

function writeArtifact(dir, artifact) {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'runtime-approval.json');
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2));
  return filePath;
}

function writeReadinessManifest(dir, serviceHeads, approvalRequest) {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'readiness-manifest.json');
  fs.writeFileSync(filePath, JSON.stringify({
    status: 'ready-for-owner-approval',
    serviceHeads,
    artifacts: { approvalRequest },
  }, null, 2));
  return { file: filePath, sha256: sha256File(filePath), status: 'verified', serviceHeads: { ...serviceHeads } };
}

function runSelfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-approval-self-test-'));
  const root = path.join(dir, 'repos');
  for (const repo of Object.values(deploymentRepos)) initSelfTestRepo(root, repo);
  const previousRoot = crossServiceRoot;
  crossServiceRoot = root;

  const validFile = writeArtifact(dir, validArtifactForRoot(root));
  const valid = validateApprovalArtifact(validFile);
  assert(valid.status === 'approved', 'valid approval artifact should pass');

  const mismatched = validArtifactForRoot(root);
  mismatched.serviceHeads.catalog = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const mismatchedFile = writeArtifact(path.join(dir, 'mismatched'), mismatched);
  let mismatchedApprovalHeadRejected = false;
  try {
    validateApprovalArtifact(mismatchedFile);
  } catch (error) {
    mismatchedApprovalHeadRejected = /head must match/.test(error.message);
  }
  assert(mismatchedApprovalHeadRejected, 'self-test must reject approval artifacts for stale service heads');

  const missingForbidden = validArtifactForRoot(root);
  missingForbidden.forbiddenActionsAcknowledged = missingForbidden.forbiddenActionsAcknowledged.filter((item) => item !== 'hard deletes');
  const missingForbiddenFile = writeArtifact(path.join(dir, 'missing-forbidden'), missingForbidden);
  let missingForbiddenActionRejected = false;
  try {
    validateApprovalArtifact(missingForbiddenFile);
  } catch (error) {
    missingForbiddenActionRejected = /forbidden actions/.test(error.message);
  }
  assert(missingForbiddenActionRejected, 'self-test must reject approval artifacts that omit forbidden action acknowledgements');

  const missingTraceInput = validArtifactForRoot(root);
  delete missingTraceInput.approvedTraceInputs.TRACE_SUPPLIER_SKU;
  const missingTraceInputFile = writeArtifact(path.join(dir, 'missing-trace-input'), missingTraceInput);
  let missingTraceInputRejected = false;
  try {
    validateApprovalArtifact(missingTraceInputFile);
  } catch (error) {
    missingTraceInputRejected = /approvedTraceInputs missing/.test(error.message);
  }
  assert(missingTraceInputRejected, 'self-test must reject approval artifacts without exact approved trace inputs');

  const missingRequest = validArtifactForRoot(root, path.join(dir, 'missing-request-source'));
  delete missingRequest.approvalRequest;
  const missingRequestFile = writeArtifact(path.join(dir, 'missing-request'), missingRequest);
  let missingApprovalRequestRejected = false;
  try {
    validateApprovalArtifact(missingRequestFile);
  } catch (error) {
    missingApprovalRequestRejected = /approvalRequest binding is required/.test(error.message);
  }
  assert(missingApprovalRequestRejected, 'self-test must reject approval artifacts without approval request binding');

  const tamperedRequest = validArtifactForRoot(root, path.join(dir, 'tampered-request-source'));
  fs.appendFileSync(tamperedRequest.approvalRequest.file, 'tampered\n');
  const tamperedRequestFile = writeArtifact(path.join(dir, 'tampered-request'), tamperedRequest);
  let tamperedApprovalRequestRejected = false;
  try {
    validateApprovalArtifact(tamperedRequestFile);
  } catch (error) {
    tamperedApprovalRequestRejected = /approvalRequest.sha256 must match/.test(error.message);
  }
  assert(tamperedApprovalRequestRejected, 'self-test must reject approval artifacts with tampered approval request binding');

  const mismatchedReadinessRequest = validArtifactForRoot(root, path.join(dir, 'mismatched-readiness-request-source'));
  const otherApprovalRequest = writeApprovalRequest(path.join(dir, 'other-request'), mismatchedReadinessRequest.serviceHeads);
  fs.appendFileSync(otherApprovalRequest.file, 'alternate owner prompt\n');
  otherApprovalRequest.bytes = fs.statSync(otherApprovalRequest.file).size;
  otherApprovalRequest.sha256 = sha256File(otherApprovalRequest.file);
  mismatchedReadinessRequest.readinessManifest = writeReadinessManifest(path.join(dir, 'mismatched-readiness-request-manifest'), mismatchedReadinessRequest.serviceHeads, otherApprovalRequest);
  const mismatchedReadinessRequestFile = writeArtifact(path.join(dir, 'mismatched-readiness-request'), mismatchedReadinessRequest);
  let mismatchedReadinessApprovalRequestRejected = false;
  try {
    validateApprovalArtifact(mismatchedReadinessRequestFile);
  } catch (error) {
    mismatchedReadinessApprovalRequestRejected = /approvalRequest must match readiness manifest/.test(error.message);
  }
  assert(mismatchedReadinessApprovalRequestRejected, 'self-test must reject approval artifacts whose request differs from the readiness manifest request');

  const missingReadiness = validArtifactForRoot(root, path.join(dir, 'missing-readiness-source'));
  delete missingReadiness.readinessManifest;
  const missingReadinessFile = writeArtifact(path.join(dir, 'missing-readiness'), missingReadiness);
  let missingReadinessManifestRejected = false;
  try {
    validateApprovalArtifact(missingReadinessFile);
  } catch (error) {
    missingReadinessManifestRejected = /readinessManifest binding is required/.test(error.message);
  }
  assert(missingReadinessManifestRejected, 'self-test must reject approval artifacts without readiness manifest binding');

  fs.writeFileSync(path.join(repoPathForService('warehouse'), 'dirty.txt'), 'dirty\n');
  let dirtyApprovalRootRejected = false;
  try {
    validateApprovalArtifact(validFile);
  } catch (error) {
    dirtyApprovalRootRejected = /worktree must be clean/.test(error.message);
  }
  assert(dirtyApprovalRootRejected, 'self-test must reject approval artifacts against dirty service worktrees');

  crossServiceRoot = previousRoot;
  console.log(JSON.stringify({
    status: 'passed',
    mismatchedApprovalHeadRejected,
    missingForbiddenActionRejected,
    dirtyApprovalRootRejected,
    missingApprovalRequestRejected,
    tamperedApprovalRequestRejected,
    mismatchedReadinessApprovalRequestRejected,
    missingReadinessManifestRejected,
    missingTraceInputRejected,
  }, null, 2));
}

try {
  if (selfTest) {
    runSelfTest();
    process.exit(0);
  }
  const filePath = fileArg || process.env.RUNTIME_APPROVAL_ARTIFACT_FILE;
  const approval = validateApprovalArtifact(filePath);
  console.log(JSON.stringify({
    status: 'approved',
    approvalFile: filePath,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    serviceHeads: approval.serviceHeads,
    approvedTraceInputs: approval.approvedTraceInputs,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
