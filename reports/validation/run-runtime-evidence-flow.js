#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const planOnly = args.has('--plan-only');
const configOnly = args.has('--config-only');
const manifestSelfTest = args.has('--manifest-self-test');
const runApprovedSmoke = process.env.RUN_APPROVED_RUNTIME_SMOKE === 'true';
const outputDir = process.env.RUNTIME_EVIDENCE_DIR || '/tmp/stock-traceability-runtime';
let crossServiceRoot = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const deploymentRepos = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

const requiredBaseEnv = [
  'WAREHOUSE_URL',
  'CATALOG_URL',
  'SUPPLIERS_URL',
  'CATALOG_TOKEN',
  'WAREHOUSE_TOKEN',
  'SUPPLIERS_TOKEN',
  'TRACE_PRODUCT_ID',
];

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function envValue(name, fallback = '') {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : fallback;
}

function requireEnv(names) {
  const missing = names.filter((name) => !envValue(name));
  assert(missing.length === 0, `Missing required env: ${missing.join(', ')}`);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCompletedEvidenceText(value) {
  return hasText(value) && !/TODO|placeholder/i.test(value);
}

function isCommitSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value.trim());
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
  assert(!status, `${deploymentRepos[service]} worktree must be clean before approved runtime evidence can use its deployment commit`);
}

function readJsonFile(filePath, label) {
  assert(fs.existsSync(filePath), `${label} does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function fileEvidence(filePath) {
  assert(fs.existsSync(filePath), `evidence artifact does not exist: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  return {
    file: filePath,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function initSelfTestRepo(root, repo) {
  const repoPath = path.join(root, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# ' + repo + '\n');
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.email=codex@example.invalid', '-c', 'user.name=Codex', 'commit', '-m', 'self-test repo'], { cwd: repoPath, stdio: 'pipe' });
  return repoPath;
}

function writeEvidenceManifest({ fixtureFile, smokeFile, deploymentFile, approvalFile, reportFile, manifestFile }) {
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assertCleanWorktreeForService(service);
  }
  const manifest = {
    status: 'runtime-complete-evidence-bundle',
    generatedAt: new Date().toISOString(),
    serviceHeads: {
      warehouse: currentHeadForService('warehouse'),
      catalog: currentHeadForService('catalog'),
      suppliers: currentHeadForService('suppliers'),
    },
    artifacts: {
      fixture: fileEvidence(fixtureFile),
      smoke: fileEvidence(smokeFile),
      deployment: fileEvidence(deploymentFile),
      approval: fileEvidence(approvalFile),
      report: fileEvidence(reportFile),
    },
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function runManifestSelfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-manifest-self-test-'));
  const previousRoot = crossServiceRoot;
  crossServiceRoot = path.join(dir, 'repos');
  for (const repo of Object.values(deploymentRepos)) {
    initSelfTestRepo(crossServiceRoot, repo);
  }
  const fixtureFile = path.join(dir, 'fixture.json');
  const smokeFile = path.join(dir, 'smoke.json');
  const deploymentFile = path.join(dir, 'deployment.json');
  const reportFile = path.join(dir, 'report.md');
  const approvalFile = path.join(dir, 'approval.json');
  const manifestFile = path.join(dir, 'manifest.json');
  fs.writeFileSync(fixtureFile, JSON.stringify({ status: 'fixture-ready' }));
  fs.writeFileSync(smokeFile, JSON.stringify({ status: 'passed-runtime' }));
  fs.writeFileSync(deploymentFile, JSON.stringify({ services: deploymentRepos }));
  fs.writeFileSync(approvalFile, JSON.stringify({ id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL', status: 'approved' }));
  fs.writeFileSync(reportFile, '# Runtime report\n- status: passed-runtime\n');
  const manifest = writeEvidenceManifest({ fixtureFile, smokeFile, deploymentFile, approvalFile, reportFile, manifestFile });
  const parsed = readJsonFile(manifestFile, 'manifest self-test output');
  assert(parsed.status === 'runtime-complete-evidence-bundle', 'manifest self-test status mismatch');
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assert(parsed.serviceHeads[service] === manifest.serviceHeads[service], `manifest self-test missing ${service} head`);
  }
  for (const artifact of ['fixture', 'smoke', 'deployment', 'approval', 'report']) {
    assert(parsed.artifacts[artifact].bytes > 0, `manifest self-test ${artifact} bytes missing`);
    assert(/^[0-9a-f]{64}$/.test(parsed.artifacts[artifact].sha256), `manifest self-test ${artifact} sha256 invalid`);
  }
  fs.writeFileSync(path.join(repoPathForService('suppliers'), 'dirty.txt'), 'dirty\n');
  let dirtyWorktreeRejected = false;
  try {
    writeEvidenceManifest({ fixtureFile, smokeFile, deploymentFile, approvalFile, reportFile, manifestFile: path.join(dir, 'dirty-manifest.json') });
  } catch (error) {
    dirtyWorktreeRejected = /worktree must be clean/.test(error.message);
  }
  assert(dirtyWorktreeRejected, 'manifest self-test must reject dirty service worktrees before writing runtime evidence');
  crossServiceRoot = previousRoot;
  console.log(JSON.stringify({ status: 'manifest-self-test-passed', manifestFile, dirtyWorktreeRejected }, null, 2));
}

function validateDeploymentEvidenceFile(filePath) {
  const deployment = readJsonFile(filePath, 'DEPLOYMENT_EVIDENCE_FILE');
  assert(deployment?.generatedFromCurrentHeads === true, 'DEPLOYMENT_EVIDENCE_FILE must be generated from current service heads');
  assert(String(deployment?.completionReminder || '').includes('verify-stock-traceability-completion.js'), 'DEPLOYMENT_EVIDENCE_FILE must include completion verifier reminder');
  const services = deployment?.services || {};
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    const item = services[service];
    assert(item, `DEPLOYMENT_EVIDENCE_FILE missing ${service} service evidence`);
    assert(isCommitSha(item.commitSha), `DEPLOYMENT_EVIDENCE_FILE ${service} commitSha must be a 7-40 character hex SHA`);
    const currentHead = currentHeadForService(service);
    assert(item.commitSha === currentHead, `DEPLOYMENT_EVIDENCE_FILE ${service} commitSha must match current ${deploymentRepos[service]} HEAD ${currentHead}`);
    assert(hasText(item.deployCommand || './scripts/deploy.sh'), `DEPLOYMENT_EVIDENCE_FILE ${service} deployCommand is required`);
    assert(isCompletedEvidenceText(item.healthEvidence), `DEPLOYMENT_EVIDENCE_FILE ${service} healthEvidence must be completed and must not contain TODO or placeholder`);
    assert(isCompletedEvidenceText(item.protectedEndpointEvidence), `DEPLOYMENT_EVIDENCE_FILE ${service} protectedEndpointEvidence must be completed and must not contain TODO or placeholder`);
    assert(/401|403/.test(item.protectedEndpointEvidence || ''), `DEPLOYMENT_EVIDENCE_FILE ${service} protectedEndpointEvidence must include 401 or 403`);
  }
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assertCleanWorktreeForService(service);
  }
  return deployment;
}

function cleanUrl(value) {
  return value.replace(/\/$/, '');
}

function shellValue(value) {
  return String(value || '').replace(/'/g, "'\\''");
}

function buildRuntimeEnv(extra = {}) {
  return {
    ...process.env,
    WAREHOUSE_URL: cleanUrl(envValue('WAREHOUSE_URL')),
    CATALOG_URL: cleanUrl(envValue('CATALOG_URL')),
    SUPPLIERS_URL: cleanUrl(envValue('SUPPLIERS_URL')),
    TRACE_PRODUCT_SKU_PREFIX: envValue('TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-'),
    ...extra,
  };
}

function redactedFixtureCommand() {
  const parts = [
    ['WAREHOUSE_URL', cleanUrl(envValue('WAREHOUSE_URL'))],
    ['CATALOG_URL', cleanUrl(envValue('CATALOG_URL'))],
    ['SUPPLIERS_URL', cleanUrl(envValue('SUPPLIERS_URL'))],
    ['CATALOG_TOKEN', '[REDACTED]'],
    ['WAREHOUSE_TOKEN', '[REDACTED]'],
    ['SUPPLIERS_TOKEN', '[REDACTED]'],
    ['TRACE_PRODUCT_ID', envValue('TRACE_PRODUCT_ID')],
    ['TRACE_PRODUCT_SKU_PREFIX', envValue('TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-')],
    ['TRACE_OWN_WAREHOUSE_ID', envValue('TRACE_OWN_WAREHOUSE_ID')],
    ['TRACE_SUPPLIER_WAREHOUSE_ID', envValue('TRACE_SUPPLIER_WAREHOUSE_ID')],
    ['TRACE_DROPSHIP_WAREHOUSE_ID', envValue('TRACE_DROPSHIP_WAREHOUSE_ID')],
  ].filter(([, value]) => value);
  return parts.map(([key, value]) => `${key}=${shellValue(value)}`).join(' ')
    + ' node reports/validation/runtime-stock-traceability-smoke.js --fixture-check';
}

function redactedSmokeCommand() {
  const parts = [
    ['WAREHOUSE_URL', cleanUrl(envValue('WAREHOUSE_URL'))],
    ['CATALOG_URL', cleanUrl(envValue('CATALOG_URL'))],
    ['SUPPLIERS_URL', cleanUrl(envValue('SUPPLIERS_URL'))],
    ['CATALOG_TOKEN', '[REDACTED]'],
    ['WAREHOUSE_TOKEN', '[REDACTED]'],
    ['SUPPLIERS_TOKEN', '[REDACTED]'],
    ['TRACE_PRODUCT_ID', envValue('TRACE_PRODUCT_ID')],
    ['TRACE_PRODUCT_SKU_PREFIX', envValue('TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-')],
    ['TRACE_OWN_WAREHOUSE_ID', envValue('TRACE_OWN_WAREHOUSE_ID')],
    ['TRACE_SUPPLIER_ID', envValue('TRACE_SUPPLIER_ID')],
    ['TRACE_SUPPLIER_WAREHOUSE_ID', envValue('TRACE_SUPPLIER_WAREHOUSE_ID')],
    ['TRACE_DROPSHIP_WAREHOUSE_ID', envValue('TRACE_DROPSHIP_WAREHOUSE_ID')],
    ['TRACE_IMPORT_IDEMPOTENCY_KEY', envValue('TRACE_IMPORT_IDEMPOTENCY_KEY')],
    ['TRACE_SUPPLIER_STOCK_QTY', envValue('TRACE_SUPPLIER_STOCK_QTY')],
    ['TRACE_SUPPLIER_SKU', envValue('TRACE_SUPPLIER_SKU')],
    ['TRACE_CLEANUP_EVIDENCE', envValue('TRACE_CLEANUP_EVIDENCE')],
    ['RUNTIME_APPROVAL_ARTIFACT_FILE', envValue('RUNTIME_APPROVAL_ARTIFACT_FILE')],
    ['TRACE_RUN_SUPPLIERS_IMPORT', 'true'],
    ['TRACE_EXPECT_SUPPLIERS_JOB', 'true'],
    ['OWNER_APPROVAL', 'explicit'],
    ['SMOKE_ALLOW_MUTATION', 'true'],
  ];
  return parts.map(([key, value]) => `${key}=${shellValue(value)}`).join(' ')
    + ' node reports/validation/runtime-stock-traceability-smoke.js';
}

function runJson(commandArgs, env, outputFile) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${commandArgs.join(' ')} failed with exit ${result.status}`);
  }
  fs.writeFileSync(outputFile, result.stdout);
  return JSON.parse(result.stdout);
}

function runNode(commandArgs, env) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  assert(result.status === 0, `${commandArgs.join(' ')} failed with exit ${result.status}`);
}

function assertApprovedTraceInputsMatchEnv(approval) {
  const inputs = approval.approvedTraceInputs || {};
  const keys = [
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
  const mismatches = keys.filter((key) => String(inputs[key] || '') !== envValue(key, key === 'TRACE_PRODUCT_SKU_PREFIX' ? 'CODEX-STOCK-TRACE-' : ''));
  assert(mismatches.length === 0, 'approved runtime smoke trace inputs must match RUNTIME_APPROVAL_ARTIFACT_FILE approvedTraceInputs: ' + mismatches.join(', '));
}

function validateRuntimeApprovalArtifactFile(filePath) {
  const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-approval-artifact.js', filePath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('runtime approval artifact validation failed: ' + (result.stdout + result.stderr).trim());
  }
  return JSON.parse(result.stdout);
}

function validateDeploymentEvidenceWithVerifier(filePath) {
  const result = spawnSync(process.execPath, ['reports/validation/verify-deployment-evidence.js', filePath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('deployment evidence verifier failed: ' + (result.stdout + result.stderr).trim());
  }
  return JSON.parse(result.stdout);
}

function validateApprovedSmokeConfig() {
  requireEnv(requiredApprovedSmokeEnv);
  assert(process.env.OWNER_APPROVAL === 'explicit', 'OWNER_APPROVAL=explicit is required for approved runtime smoke');
  assert(process.env.SMOKE_ALLOW_MUTATION === 'true', 'SMOKE_ALLOW_MUTATION=true is required for approved runtime smoke');
  const approval = validateRuntimeApprovalArtifactFile(envValue('RUNTIME_APPROVAL_ARTIFACT_FILE'));
  assertApprovedTraceInputsMatchEnv(approval);
  validateDeploymentEvidenceWithVerifier(envValue('DEPLOYMENT_EVIDENCE_FILE'));
  validateDeploymentEvidenceFile(envValue('DEPLOYMENT_EVIDENCE_FILE'));
}

function printPlan() {
  console.log(JSON.stringify({
    status: 'plan-only',
    outputDir,
    requiredBaseEnv,
    requiredApprovedSmokeEnv,
    approvalArtifactValidation: 'requires RUNTIME_APPROVAL_ARTIFACT_FILE with owner approval, exact approvedTraceInputs, synthetic-only scope, forbidden-action acknowledgement, clean current service heads, and service SHAs matching current repo HEADs',
    deploymentEvidenceValidation: 'requires DEPLOYMENT_EVIDENCE_FILE generated by create-deployment-evidence.js or accepted by verify-deployment-evidence.js with warehouse/catalog/suppliers commit SHA matching current repo HEAD, deploy command, completed health evidence, and 401/403 protected endpoint evidence',
    sourceFingerprintEvidence: 'TRACE_SUPPLIER_STOCK_QTY and TRACE_SUPPLIER_SKU are required for approved smoke so the redacted command proves the Suppliers sourceFingerprint exactly',
    runApprovedSmokeEnv: 'RUN_APPROVED_RUNTIME_SMOKE=true',
    artifacts: {
      fixture: path.join(outputDir, 'stock-traceability-fixture-check-result.json'),
      smoke: path.join(outputDir, 'stock-traceability-smoke-result.json'),
      report: envValue('RUNTIME_EVIDENCE_OUTPUT', 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md'),
      approval: envValue('RUNTIME_APPROVAL_ARTIFACT_FILE', '/tmp/stock-traceability-runtime-approval.json'),
      manifest: envValue('RUNTIME_EVIDENCE_MANIFEST', path.join(outputDir, 'stock-traceability-runtime-evidence-manifest.json')),
    },
    order: [
      'Validate approved-smoke owner, mutation, cleanup, runtime approval artifact, and deployment evidence before any live request when RUN_APPROVED_RUNTIME_SMOKE=true.',
      'Run source preflight.',
      'Run read-only fixture check and save fixture JSON.',
      'Stop unless RUN_APPROVED_RUNTIME_SMOKE=true is set.',
      'Run approved mutation smoke and save smoke JSON.',
      'Generate final runtime report with redacted fixture and smoke commands.',
      'Verify final runtime report.',
      'Verify the complete runtime report and manifest with verify-stock-traceability-completion.js before printing runtime-complete.',
    ],
  }, null, 2));
}

try {
  if (manifestSelfTest) {
    runManifestSelfTest();
    process.exit(0);
  }

  if (planOnly) {
    printPlan();
    process.exit(0);
  }

  requireEnv(requiredBaseEnv);
  if (runApprovedSmoke) validateApprovedSmokeConfig();

  const fixtureFile = path.join(outputDir, 'stock-traceability-fixture-check-result.json');
  const smokeFile = path.join(outputDir, 'stock-traceability-smoke-result.json');
  fs.mkdirSync(outputDir, { recursive: true });

  if (configOnly) {
    if (runApprovedSmoke) validateApprovedSmokeConfig();
    console.log(JSON.stringify({
      status: 'config-only',
      outputDir,
      runApprovedSmoke,
      approvedSmokeConfigReady: runApprovedSmoke,
      runtimeApprovalArtifactFile: runApprovedSmoke ? envValue('RUNTIME_APPROVAL_ARTIFACT_FILE') : null,
      redactedFixtureCommand: redactedFixtureCommand(),
      redactedSmokeCommand: runApprovedSmoke ? redactedSmokeCommand() : null,
    }, null, 2));
    process.exit(0);
  }

  runNode(['reports/validation/cross-service-preflight-check.js'], process.env);

  const fixture = runJson(
    ['reports/validation/runtime-stock-traceability-smoke.js', '--fixture-check'],
    buildRuntimeEnv({
      SMOKE_FIXTURE_CHECK: 'true',
      TRACE_RUN_SUPPLIERS_IMPORT: 'false',
      OWNER_APPROVAL: '',
      SMOKE_ALLOW_MUTATION: '',
    }),
    fixtureFile,
  );

  assert(fixture.status === 'fixture-ready', 'fixture check must return fixture-ready before approved smoke');
  assert(fixture.fixtureCheck === true, 'fixture check output must prove fixtureCheck=true');
  assert(fixture.mutationEnabled === false, 'fixture check output must prove mutationEnabled=false');
  assert(fixture.supplierImport?.triggered !== true, 'fixture check must not trigger supplier import');

  if (!runApprovedSmoke) {
    console.log(JSON.stringify({
      status: 'fixture-ready',
      fixtureFile,
      next: 'Set RUN_APPROVED_RUNTIME_SMOKE=true with owner approval, RUNTIME_APPROVAL_ARTIFACT_FILE, and deployment evidence to continue.',
    }, null, 2));
    process.exit(0);
  }

  requireEnv(requiredApprovedSmokeEnv);
  assert(process.env.OWNER_APPROVAL === 'explicit', 'OWNER_APPROVAL=explicit is required for approved runtime smoke');
  assert(process.env.SMOKE_ALLOW_MUTATION === 'true', 'SMOKE_ALLOW_MUTATION=true is required for approved runtime smoke');

  runJson(
    ['reports/validation/runtime-stock-traceability-smoke.js'],
    buildRuntimeEnv({
      TRACE_RUN_SUPPLIERS_IMPORT: 'true',
      TRACE_EXPECT_SUPPLIERS_JOB: 'true',
      OWNER_APPROVAL: 'explicit',
      SMOKE_ALLOW_MUTATION: 'true',
    }),
    smokeFile,
  );

  const reportEnv = {
    ...process.env,
    FIXTURE_CHECK_RESULT_FILE: fixtureFile,
    SMOKE_RESULT_FILE: smokeFile,
    DEPLOYMENT_EVIDENCE_FILE: envValue('DEPLOYMENT_EVIDENCE_FILE'),
    RUNTIME_EVIDENCE_OUTPUT: envValue('RUNTIME_EVIDENCE_OUTPUT', 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md'),
    REDACTED_FIXTURE_COMMAND: redactedFixtureCommand(),
    REDACTED_SMOKE_COMMAND: redactedSmokeCommand(),
  };
  runNode(['reports/validation/generate-runtime-evidence-report.js'], reportEnv);
  runNode(['reports/validation/verify-runtime-evidence-report.js'], {
    ...process.env,
    RUNTIME_EVIDENCE_REPORT: reportEnv.RUNTIME_EVIDENCE_OUTPUT,
  });

  const manifestFile = envValue('RUNTIME_EVIDENCE_MANIFEST', path.join(outputDir, 'stock-traceability-runtime-evidence-manifest.json'));
  writeEvidenceManifest({
    fixtureFile,
    smokeFile,
    deploymentFile: envValue('DEPLOYMENT_EVIDENCE_FILE'),
    approvalFile: envValue('RUNTIME_APPROVAL_ARTIFACT_FILE'),
    reportFile: reportEnv.RUNTIME_EVIDENCE_OUTPUT,
    manifestFile,
  });
  runNode(['reports/validation/verify-runtime-evidence-manifest.js', manifestFile], process.env);
  runNode(['reports/validation/verify-runtime-evidence-bundle.js', manifestFile, reportEnv.RUNTIME_EVIDENCE_OUTPUT], process.env);
  runNode(['reports/validation/verify-stock-traceability-completion.js', reportEnv.RUNTIME_EVIDENCE_OUTPUT, manifestFile], process.env);

  console.log(JSON.stringify({
    status: 'runtime-complete',
    fixtureFile,
    smokeFile,
    reportFile: reportEnv.RUNTIME_EVIDENCE_OUTPUT,
    manifestFile,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
