#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const defaultManifest = '/tmp/stock-traceability-runtime-readiness/stock-traceability-runtime-readiness-manifest.json';
const manifestFile = args.find((arg) => !arg.startsWith('--')) || process.env.RUNTIME_READINESS_MANIFEST || defaultManifest;

const services = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repoPathFor(repo, serviceRoot = root) {
  const repoPath = path.join(serviceRoot, repo);
  assert(fs.existsSync(repoPath), `Repository not found: ${repoPath}`);
  return repoPath;
}

function git(repo, gitArgs, serviceRoot = root) {
  return execFileSync('git', gitArgs, { cwd: repoPathFor(repo, serviceRoot), encoding: 'utf8' }).trim();
}

function currentServiceRows(serviceRoot = root) {
  return Object.entries(services).map(([name, repo]) => {
    const status = git(repo, ['status', '--short'], serviceRoot);
    return {
      name,
      repo,
      head: git(repo, ['rev-parse', 'HEAD'], serviceRoot),
      dirtyLines: status ? status.split('\n').length : 0,
    };
  });
}

function assertCleanRows(rows) {
  const dirty = rows.filter((row) => row.dirtyLines !== 0);
  assert(dirty.length === 0, 'readiness bundle verifier requires clean Warehouse, Catalog, and Suppliers worktrees; dirty services: ' + dirty.map((row) => row.repo).join(', '));
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertArtifact(manifest, key) {
  assert(manifest.artifacts && manifest.artifacts[key], `readiness manifest missing ${key} artifact`);
  const artifact = manifest.artifacts[key];
  assert(path.isAbsolute(artifact.file), `${key} artifact file must be an absolute path`);
  assert(fs.existsSync(artifact.file), `${key} artifact file is missing: ${artifact.file}`);
  const actual = sha256File(artifact.file);
  assert(actual.bytes === artifact.bytes, `${key} artifact byte count mismatch`);
  assert(actual.sha256 === artifact.sha256, `${key} artifact sha256 mismatch`);
  return fs.readFileSync(artifact.file, 'utf8');
}

function assertContainsHeads(label, text, rows) {
  for (const row of rows) {
    assert(text.includes(row.head), `${label} does not include current ${row.name} head ${row.head}`);
  }
}

function verifyReadinessManifest(filePath, serviceRoot = root) {
  assert(fs.existsSync(filePath), `readiness manifest is missing: ${filePath}`);
  const rows = currentServiceRows(serviceRoot);
  assertCleanRows(rows);
  const manifest = readJson(filePath);
  assert(manifest.status === 'ready-for-owner-approval', 'readiness manifest status must be ready-for-owner-approval');
  assert(manifest.completionGate === 'incomplete-runtime-pending', 'readiness manifest must preserve incomplete runtime completion gate');
  assert(manifest.serviceHeads && typeof manifest.serviceHeads === 'object', 'readiness manifest serviceHeads are required');
  for (const row of rows) {
    assert(manifest.serviceHeads[row.name] === row.head, `readiness manifest ${row.name} head must match current ${row.repo} HEAD ${row.head}`);
  }

  const approvalRequest = assertArtifact(manifest, 'approvalRequest');
  const deploymentTemplate = assertArtifact(manifest, 'deploymentTemplate');
  const handoff = assertArtifact(manifest, 'handoff');
  const planText = assertArtifact(manifest, 'plan');

  assertContainsHeads('approval request', approvalRequest, rows);
  assertContainsHeads('deployment template', deploymentTemplate, rows);
  assertContainsHeads('runtime handoff', handoff, rows);
  assert(approvalRequest.includes('STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST'), 'approval request artifact must include approval request id');
  assert(deploymentTemplate.includes('generatedFromCurrentHeads'), 'deployment template artifact must include generatedFromCurrentHeads marker');
  assert(handoff.includes('STOCK-TRACEABILITY-RUNTIME-HANDOFF'), 'handoff artifact must include handoff id');
  assert(handoff.includes('create-runtime-readiness-bundle.js'), 'handoff artifact must preserve readiness bundle command');

  const plan = JSON.parse(planText);
  assert(plan.status === 'plan-only', 'readiness plan artifact must be plan-only');
  assert(Array.isArray(plan.requiredApprovedSmokeEnv), 'readiness plan artifact must list required approved-smoke env vars');
  assert(plan.requiredApprovedSmokeEnv.includes('RUNTIME_APPROVAL_ARTIFACT_FILE'), 'readiness plan artifact must require RUNTIME_APPROVAL_ARTIFACT_FILE');
  assert(plan.requiredApprovedSmokeEnv.includes('DEPLOYMENT_EVIDENCE_FILE'), 'readiness plan artifact must require DEPLOYMENT_EVIDENCE_FILE');
  assert(String(manifest.nextRequiredAction || '').includes('Owner approval'), 'readiness manifest must state owner approval remains required');

  return { manifest, rows };
}

function initSelfTestRepo(serviceRoot, repo) {
  const repoPath = path.join(serviceRoot, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  fs.writeFileSync(path.join(repoPath, 'README.md'), repo + '\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.email=traceability@example.test', '-c', 'user.name=Traceability Check', 'commit', '-m', 'Initial readiness verifier fixture'], { cwd: repoPath, stdio: 'pipe' });
}

function writeSelfTestBundle(serviceRoot) {
  const rows = currentServiceRows(serviceRoot);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-readiness-verify-'));
  const files = {
    approvalRequest: path.join(dir, 'stock-traceability-runtime-approval-request.md'),
    deploymentTemplate: path.join(dir, 'stock-traceability-deployment-evidence.template.json'),
    handoff: path.join(dir, 'stock-traceability-runtime-handoff.md'),
    plan: path.join(dir, 'stock-traceability-runtime-plan.json'),
  };
  const heads = rows.map((row) => `${row.name}:${row.head}`).join('\n');
  fs.writeFileSync(files.approvalRequest, `STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST\n${heads}\n`);
  fs.writeFileSync(files.deploymentTemplate, JSON.stringify({ generatedFromCurrentHeads: true, heads: Object.fromEntries(rows.map((row) => [row.name, row.head])) }, null, 2) + '\n');
  fs.writeFileSync(files.handoff, `STOCK-TRACEABILITY-RUNTIME-HANDOFF\ncreate-runtime-readiness-bundle.js\n${heads}\n`);
  fs.writeFileSync(files.plan, JSON.stringify({ status: 'plan-only', requiredApprovedSmokeEnv: ['RUNTIME_APPROVAL_ARTIFACT_FILE', 'DEPLOYMENT_EVIDENCE_FILE'] }, null, 2) + '\n');
  const artifacts = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, { file, ...sha256File(file) }]));
  const manifest = {
    status: 'ready-for-owner-approval',
    generatedAt: new Date().toISOString(),
    completionGate: 'incomplete-runtime-pending',
    serviceHeads: Object.fromEntries(rows.map((row) => [row.name, row.head])),
    artifacts,
    nextRequiredAction: 'Owner approval, deployment, completed deployment evidence, and guarded runtime smoke are still required before completion.',
  };
  const manifestPath = path.join(dir, 'stock-traceability-runtime-readiness-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { manifestPath, files, rows };
}

function runSelfTest() {
  const serviceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-readiness-root-'));
  for (const repo of Object.values(services)) initSelfTestRepo(serviceRoot, repo);
  const { manifestPath, files, rows } = writeSelfTestBundle(serviceRoot);
  const verified = verifyReadinessManifest(manifestPath, serviceRoot);
  assert(verified.rows.length === rows.length, 'self-test verifier must return service rows');

  fs.appendFileSync(files.plan, '\ntampered\n');
  let tamperedHashRejected = false;
  try {
    verifyReadinessManifest(manifestPath, serviceRoot);
  } catch (error) {
    tamperedHashRejected = /sha256 mismatch|byte count mismatch/.test(error.message);
  }
  assert(tamperedHashRejected, 'readiness verifier self-test must reject tampered artifacts');

  const { manifestPath: staleManifestPath } = writeSelfTestBundle(serviceRoot);
  fs.writeFileSync(path.join(serviceRoot, services.catalog, 'dirty.txt'), 'dirty\n');
  let dirtyWorktreeRejected = false;
  try {
    verifyReadinessManifest(staleManifestPath, serviceRoot);
  } catch (error) {
    dirtyWorktreeRejected = /requires clean/.test(error.message);
  }
  assert(dirtyWorktreeRejected, 'readiness verifier self-test must reject dirty service worktrees');

  fs.unlinkSync(path.join(serviceRoot, services.catalog, 'dirty.txt'));
  fs.appendFileSync(path.join(serviceRoot, services.catalog, 'README.md'), 'advanced head\n');
  execFileSync('git', ['add', 'README.md'], { cwd: path.join(serviceRoot, services.catalog), stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.email=traceability@example.test', '-c', 'user.name=Traceability Check', 'commit', '-m', 'Advance catalog head'], { cwd: path.join(serviceRoot, services.catalog), stdio: 'pipe' });
  let staleHeadRejected = false;
  try {
    verifyReadinessManifest(staleManifestPath, serviceRoot);
  } catch (error) {
    staleHeadRejected = /head must match current/.test(error.message);
  }
  assert(staleHeadRejected, 'readiness verifier self-test must reject stale service heads');

  console.log(JSON.stringify({ status: 'passed', artifacts: Object.keys(files), tamperedHashRejected, dirtyWorktreeRejected, staleHeadRejected }, null, 2));
}

try {
  if (selfTest) {
    runSelfTest();
  } else {
    const result = verifyReadinessManifest(manifestFile);
    console.log(JSON.stringify({ status: 'verified', manifestFile, services: result.rows.map((row) => row.name), nextRequiredAction: result.manifest.nextRequiredAction }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
