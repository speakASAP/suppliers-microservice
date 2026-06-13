#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const outputDir = process.env.RUNTIME_READINESS_BUNDLE_DIR || '/tmp/stock-traceability-runtime-readiness';

const requiredApprovedSmokeEnv = [
  'TRACE_SUPPLIER_ID',
  'TRACE_OWN_WAREHOUSE_ID',
  'TRACE_SUPPLIER_WAREHOUSE_ID',
  'TRACE_DROPSHIP_WAREHOUSE_ID',
  'TRACE_IMPORT_IDEMPOTENCY_KEY',
  'TRACE_SUPPLIER_STOCK_QTY',
  'TRACE_SUPPLIER_SKU',
  'TRACE_CLEANUP_EVIDENCE',
  'DEPLOYMENT_EVIDENCE_FILE',
  'RUNTIME_APPROVAL_ARTIFACT_FILE',
];

const services = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repoPathFor(repo) {
  const repoPath = path.join(root, repo);
  assert(fs.existsSync(repoPath), `Repository not found: ${repoPath}`);
  return repoPath;
}

function git(repo, gitArgs) {
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === 'HEAD') return repo.slice(0, 3).padEnd(40, '0');
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === '--abbrev-ref') return 'self-test-branch';
  if (selfTest && gitArgs[0] === 'status') return '';
  return execFileSync('git', gitArgs, { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
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
  assert(dirty.length === 0, 'runtime readiness bundle requires clean Warehouse, Catalog, and Suppliers worktrees; dirty services: ' + dirty.map((row) => row.repo).join(', '));
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    file: filePath,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function runCapture(commandArgs, env, outputFile) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  });
  if (result.status !== 0) {
    throw new Error(commandArgs.join(' ') + ' failed: ' + (result.stdout + result.stderr).trim());
  }
  fs.writeFileSync(outputFile, result.stdout);
}

function runInherit(commandArgs, env) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(commandArgs.join(' ') + ' failed: ' + (result.stdout + result.stderr).trim());
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function verifyBundle(manifestFile) {
  const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-readiness-bundle.js', manifestFile], {
    cwd: process.cwd(),
    env: { ...process.env, CROSS_SERVICE_ROOT: root },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('readiness bundle verifier failed: ' + (result.stdout + result.stderr).trim());
  }
  const parsed = JSON.parse(result.stdout);
  assert(parsed.status === 'verified', 'readiness bundle verifier must return verified status');
  return parsed;
}

function assertArtifactContainsHeads(filePath, rows) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const row of rows) {
    assert(text.includes(row.head), `${path.basename(filePath)} does not include current ${row.name} head ${row.head}`);
  }
}

function assertPlanRequiresApprovedSmokeEnv(plan) {
  assert(plan.status === 'plan-only', 'runtime plan artifact must be plan-only');
  assert(Array.isArray(plan.requiredApprovedSmokeEnv), 'runtime plan artifact must list required approved-smoke env vars');
  const missingPlanEnv = requiredApprovedSmokeEnv.filter((name) => !plan.requiredApprovedSmokeEnv.includes(name));
  assert(missingPlanEnv.length === 0, 'runtime plan artifact must require approved-smoke env vars: ' + missingPlanEnv.join(', '));
}

function writeBundle(rows) {
  fs.mkdirSync(outputDir, { recursive: true });
  const approvalRequestFile = path.join(outputDir, 'stock-traceability-runtime-approval-request.md');
  const deploymentTemplateFile = path.join(outputDir, 'stock-traceability-deployment-evidence.template.json');
  const handoffFile = path.join(outputDir, 'stock-traceability-runtime-handoff.md');
  const planFile = path.join(outputDir, 'stock-traceability-runtime-plan.json');
  const manifestFile = path.join(outputDir, 'stock-traceability-runtime-readiness-manifest.json');

  runInherit(['reports/validation/create-runtime-approval-request.js'], { RUNTIME_APPROVAL_REQUEST_OUTPUT: approvalRequestFile });
  runInherit(['reports/validation/create-deployment-evidence-template.js'], { DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT: deploymentTemplateFile });
  runInherit(['reports/validation/create-runtime-handoff-checklist.js'], { RUNTIME_HANDOFF_OUTPUT: handoffFile });
  runCapture(['reports/validation/run-runtime-evidence-flow.js', '--plan-only'], {}, planFile);

  assertArtifactContainsHeads(approvalRequestFile, rows);
  assertArtifactContainsHeads(deploymentTemplateFile, rows);
  assertArtifactContainsHeads(handoffFile, rows);
  const plan = readJson(planFile);
  assertPlanRequiresApprovedSmokeEnv(plan);

  const manifest = {
    status: 'ready-for-owner-approval',
    generatedAt: new Date().toISOString(),
    completionGate: 'incomplete-runtime-pending',
    serviceHeads: Object.fromEntries(rows.map((row) => [row.name, row.head])),
    artifacts: {
      approvalRequest: sha256File(approvalRequestFile),
      deploymentTemplate: sha256File(deploymentTemplateFile),
      handoff: sha256File(handoffFile),
      plan: sha256File(planFile),
    },
    nextRequiredAction: 'Owner approval, deployment, completed deployment evidence, and guarded runtime smoke are still required before completion.',
  };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  const verification = verifyBundle(manifestFile);
  return { manifest, manifestFile, verification };
}

function assertSelfTestContent() {
  const rows = serviceRows();
  assertCleanRows(rows);
  const dirtyRows = rows.map((row, index) => index === 0 ? { ...row, dirtyLines: 1 } : row);
  let dirtyRowsRejected = false;
  try {
    assertCleanRows(dirtyRows);
  } catch (error) {
    dirtyRowsRejected = /requires clean/.test(error.message);
  }
  assert(dirtyRowsRejected, 'readiness bundle self-test must reject dirty service snapshots');
  const fakeFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-head-check-')), 'artifact.txt');
  fs.writeFileSync(fakeFile, rows.map((row) => row.head).join('\n'));
  assertArtifactContainsHeads(fakeFile, rows);
  const missingHeadFile = path.join(path.dirname(fakeFile), 'missing-head.txt');
  fs.writeFileSync(missingHeadFile, rows.slice(1).map((row) => row.head).join('\n'));
  let missingHeadRejected = false;
  try {
    assertArtifactContainsHeads(missingHeadFile, rows);
  } catch (error) {
    missingHeadRejected = /does not include current/.test(error.message);
  }
  assert(missingHeadRejected, 'readiness bundle self-test must reject artifacts missing service heads');
  assertPlanRequiresApprovedSmokeEnv({ status: 'plan-only', requiredApprovedSmokeEnv });
  let missingPlanEnvRejected = false;
  try {
    assertPlanRequiresApprovedSmokeEnv({ status: 'plan-only', requiredApprovedSmokeEnv: ['RUNTIME_APPROVAL_ARTIFACT_FILE'] });
  } catch (error) {
    missingPlanEnvRejected = /approved-smoke env vars/.test(error.message) && /TRACE_SUPPLIER_ID/.test(error.message);
  }
  assert(missingPlanEnvRejected, 'readiness bundle self-test must reject plan artifacts missing approved-smoke trace inputs');
  let missingManifestVerificationRejected = false;
  try {
    verifyBundle(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-missing-manifest-')), 'missing-manifest.json'));
  } catch (error) {
    missingManifestVerificationRejected = /readiness bundle verifier failed/.test(error.message) && /readiness manifest is missing/.test(error.message);
  }
  assert(missingManifestVerificationRejected, 'readiness bundle self-test must fail closed when verifier rejects the generated manifest');
  console.log(JSON.stringify({ status: 'passed', services: rows.length, dirtyRowsRejected, missingHeadRejected, missingPlanEnvRejected, missingManifestVerificationRejected }, null, 2));
}

try {
  const rows = serviceRows();
  assertCleanRows(rows);
  if (selfTest) {
    assertSelfTestContent();
    process.exit(0);
  }
  const { manifest, manifestFile, verification } = writeBundle(rows);
  console.log(JSON.stringify({ status: 'written-and-verified', outputDir, manifestFile, services: Object.keys(manifest.serviceHeads), verification: verification.status }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
