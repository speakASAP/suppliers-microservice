#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const outputFile = process.env.DEPLOYMENT_EVIDENCE_OUTPUT || '/tmp/stock-traceability-deployment-evidence.json';
const defaultReadinessManifestFile = '/tmp/stock-traceability-runtime-readiness/stock-traceability-runtime-readiness-manifest.json';
let root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';

const serviceConfig = {
  warehouse: {
    repo: 'warehouse-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEnv: 'WAREHOUSE_HEALTH_EVIDENCE',
    protectedEnv: 'WAREHOUSE_PROTECTED_ENDPOINT_EVIDENCE',
  },
  catalog: {
    repo: 'catalog-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEnv: 'CATALOG_HEALTH_EVIDENCE',
    protectedEnv: 'CATALOG_PROTECTED_ENDPOINT_EVIDENCE',
  },
  suppliers: {
    repo: 'suppliers-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEnv: 'SUPPLIERS_HEALTH_EVIDENCE',
    protectedEnv: 'SUPPLIERS_PROTECTED_ENDPOINT_EVIDENCE',
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function envValue(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : '';
}

function repoPathFor(repo) {
  const repoPath = path.join(root, repo);
  assert(fs.existsSync(repoPath), `Repository not found: ${repoPath}`);
  return repoPath;
}

function assertCleanWorktree(repo) {
  const status = execFileSync('git', ['status', '--short'], { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
  assert(!status, `${repo} worktree must be clean before generating completed deployment evidence`);
}

function commitShaFor(repo) {
  assertCleanWorktree(repo);
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
}

function requireEvidenceText(name) {
  const value = envValue(name);
  assert(value, `${name} is required to generate completed deployment evidence`);
  assert(!/TODO|placeholder/i.test(value), `${name} must be completed and must not contain TODO or placeholder`);
  assert(!/Bearer\s+|TOKEN|SERVICE_TOKEN|api[_-]?key|secret|password/i.test(value), `${name} must not contain token or credential values`);
  return value;
}

function requireProtectedEvidence(name) {
  const value = requireEvidenceText(name);
  assert(/401|403/.test(value), `${name} must include anonymous 401 or 403 protected-endpoint evidence`);
  return value;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function verifyReadinessManifestBinding() {
  const readinessManifestFile = process.env.RUNTIME_READINESS_MANIFEST_FILE || defaultReadinessManifestFile;
  assert(fs.existsSync(readinessManifestFile), 'RUNTIME_READINESS_MANIFEST_FILE does not exist: ' + readinessManifestFile);
  if (!selfTest) {
    const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-readiness-bundle.js', readinessManifestFile], {
      cwd: process.cwd(),
      env: { ...process.env, CROSS_SERVICE_ROOT: root },
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error('runtime readiness manifest failed verifier: ' + (result.stdout + result.stderr).trim());
    const parsed = JSON.parse(result.stdout);
    assert(parsed.status === 'verified', 'runtime readiness manifest must verify before completed deployment evidence generation');
  }
  const manifest = JSON.parse(fs.readFileSync(readinessManifestFile, 'utf8'));
  assert(manifest.status === 'ready-for-owner-approval', 'runtime readiness manifest must be ready-for-owner-approval');
  return {
    file: readinessManifestFile,
    sha256: sha256File(readinessManifestFile),
    status: 'verified',
    serviceHeads: manifest.serviceHeads || {},
  };
}

function buildEvidence() {
  const services = {};
  for (const [name, config] of Object.entries(serviceConfig)) {
    services[name] = {
      commitSha: commitShaFor(config.repo),
      deployCommand: config.deployCommand,
      healthEvidence: requireEvidenceText(config.healthEnv),
      protectedEndpointEvidence: requireProtectedEvidence(config.protectedEnv),
    };
  }
  const readinessManifest = verifyReadinessManifestBinding();
  for (const [service, item] of Object.entries(services)) {
    assert(readinessManifest.serviceHeads[service] === item.commitSha, 'deployment evidence ' + service + ' commitSha must match readiness manifest service head');
  }
  return {
    generatedAt: new Date().toISOString(),
    generatedFromCurrentHeads: true,
    readinessManifest,
    completionReminder: 'Deployment evidence is valid only when each commitSha still matches the current remote repo HEAD and verify-stock-traceability-completion.js passes against the generated runtime manifest.',
    services,
  };
}

function validateWithVerifier(filePath) {
  if (selfTest) return;
  const result = spawnSync(process.execPath, ['reports/validation/verify-deployment-evidence.js', filePath], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('generated deployment evidence failed verifier: ' + (result.stdout + result.stderr).trim());
}

function initSelfTestRepo(repo) {
  const repoPath = path.join(root, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# ' + repo + '\n');
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.email=codex@example.invalid', '-c', 'user.name=Codex', 'commit', '-m', 'self-test repo'], { cwd: repoPath, stdio: 'pipe' });
}

function writeSelfTestReadinessManifest() {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-deployment-readiness-')), 'readiness-manifest.json');
  const serviceHeads = Object.fromEntries(Object.entries(serviceConfig).map(([name, config]) => [name, commitShaFor(config.repo)]));
  fs.writeFileSync(filePath, JSON.stringify({ status: 'ready-for-owner-approval', serviceHeads, artifacts: {} }, null, 2) + '\n');
  process.env.RUNTIME_READINESS_MANIFEST_FILE = filePath;
  return filePath;
}

function seedSelfTestEnv() {
  process.env.WAREHOUSE_HEALTH_EVIDENCE = 'Warehouse /api/health returned 200 after deployment';
  process.env.WAREHOUSE_PROTECTED_ENDPOINT_EVIDENCE = 'Anonymous Warehouse topology returned 401 after deployment';
  process.env.CATALOG_HEALTH_EVIDENCE = 'Catalog /health returned 200 after deployment';
  process.env.CATALOG_PROTECTED_ENDPOINT_EVIDENCE = 'Anonymous Catalog availability coverage returned 403 after deployment';
  process.env.SUPPLIERS_HEALTH_EVIDENCE = 'Suppliers /api/health returned 200 after deployment';
  process.env.SUPPLIERS_PROTECTED_ENDPOINT_EVIDENCE = 'Anonymous Suppliers imports returned 401 after deployment';
}

function runSelfTest() {
  root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-deployment-evidence-generator-')), 'repos');
  for (const config of Object.values(serviceConfig)) initSelfTestRepo(config.repo);
  seedSelfTestEnv();
  writeSelfTestReadinessManifest();
  const evidence = buildEvidence();
  assert(evidence.generatedFromCurrentHeads === true, 'self-test current-head marker missing');
  assert(evidence.readinessManifest && evidence.readinessManifest.status === 'verified', 'self-test readiness manifest binding missing');
  assert(evidence.completionReminder.includes('verify-stock-traceability-completion.js'), 'self-test completion reminder missing');
  assert(/^[0-9a-f]{40}$/.test(evidence.services.warehouse.commitSha), 'self-test warehouse SHA missing');
  assert(evidence.services.catalog.protectedEndpointEvidence.includes('403'), 'self-test catalog protected evidence missing');

  const previousWarehouseHealth = process.env.WAREHOUSE_HEALTH_EVIDENCE;
  process.env.WAREHOUSE_HEALTH_EVIDENCE = '';
  let missingHealthRejected = false;
  try {
    buildEvidence();
  } catch (error) {
    missingHealthRejected = /WAREHOUSE_HEALTH_EVIDENCE is required/.test(error.message);
  }
  process.env.WAREHOUSE_HEALTH_EVIDENCE = previousWarehouseHealth;
  assert(missingHealthRejected, 'self-test must reject missing health evidence');

  const previousCatalogAuth = process.env.CATALOG_PROTECTED_ENDPOINT_EVIDENCE;
  process.env.CATALOG_PROTECTED_ENDPOINT_EVIDENCE = 'Anonymous Catalog coverage returned 200 after deployment';
  let weakProtectedEvidenceRejected = false;
  try {
    buildEvidence();
  } catch (error) {
    weakProtectedEvidenceRejected = /must include anonymous 401 or 403/.test(error.message);
  }
  process.env.CATALOG_PROTECTED_ENDPOINT_EVIDENCE = previousCatalogAuth;
  assert(weakProtectedEvidenceRejected, 'self-test must reject weak protected endpoint evidence');

  const previousSuppliersHealth = process.env.SUPPLIERS_HEALTH_EVIDENCE;
  process.env.SUPPLIERS_HEALTH_EVIDENCE = 'placeholder Suppliers /api/health response after deployment';
  let placeholderEvidenceRejected = false;
  try {
    buildEvidence();
  } catch (error) {
    placeholderEvidenceRejected = /must be completed/.test(error.message);
  }
  process.env.SUPPLIERS_HEALTH_EVIDENCE = previousSuppliersHealth;
  assert(placeholderEvidenceRejected, 'self-test must reject placeholder deployment evidence');

  fs.writeFileSync(path.join(repoPathFor(serviceConfig.suppliers.repo), 'dirty.txt'), 'dirty\n');
  let dirtyWorktreeRejected = false;
  try {
    buildEvidence();
  } catch (error) {
    dirtyWorktreeRejected = /worktree must be clean/.test(error.message);
  }
  assert(dirtyWorktreeRejected, 'self-test must reject dirty service worktrees');

  console.log(JSON.stringify({ status: 'passed', services: Object.keys(evidence.services), missingHealthRejected, weakProtectedEvidenceRejected, placeholderEvidenceRejected, dirtyWorktreeRejected }, null, 2));
}

try {
  if (selfTest) {
    runSelfTest();
    process.exit(0);
  }
  const evidence = buildEvidence();
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(evidence, null, 2) + '\n');
  validateWithVerifier(outputFile);
  console.log(JSON.stringify({ status: 'written', outputFile, services: Object.keys(evidence.services) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
