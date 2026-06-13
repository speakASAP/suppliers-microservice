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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCompletedEvidenceText(value) {
  return hasText(value) && !/TODO/i.test(value);
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
  assert(!status, `${deploymentRepos[service]} worktree must be clean before deployment evidence can authorize runtime proof`);
}

function readJsonFile(filePath) {
  assert(filePath, 'DEPLOYMENT_EVIDENCE_FILE is required');
  assert(fs.existsSync(filePath), `DEPLOYMENT_EVIDENCE_FILE does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`DEPLOYMENT_EVIDENCE_FILE is not valid JSON: ${error.message}`);
  }
}

function assertNoSecrets(deploymentText) {
  assert(!/Bearer\s+|CATALOG_TOKEN|WAREHOUSE_TOKEN|SUPPLIERS_TOKEN|SERVICE_TOKEN|api[_-]?key|secret|password/i.test(deploymentText), 'deployment evidence must not contain token or credential values');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertReadinessManifestBinding(deployment, artifactDir) {
  const readiness = deployment.readinessManifest;
  assert(readiness && typeof readiness === 'object', 'deployment evidence readinessManifest binding is required');
  assert(readiness.status === 'verified', 'deployment evidence readinessManifest.status must be verified');
  assert(hasText(readiness.file), 'deployment evidence readinessManifest.file is required');
  assert(/^[0-9a-f]{64}$/i.test(readiness.sha256 || ''), 'deployment evidence readinessManifest.sha256 must be a 64-character hex digest');
  const readinessFile = path.isAbsolute(readiness.file) ? readiness.file : path.join(artifactDir, readiness.file);
  assert(fs.existsSync(readinessFile), 'deployment evidence readinessManifest.file does not exist: ' + readiness.file);
  assert(sha256File(readinessFile) === readiness.sha256, 'deployment evidence readinessManifest.sha256 must match readiness manifest file');
  if (!selfTest) {
    const result = spawnSync(process.execPath, ['reports/validation/verify-runtime-readiness-bundle.js', readinessFile], {
      cwd: process.cwd(),
      env: { ...process.env, CROSS_SERVICE_ROOT: crossServiceRoot },
      encoding: 'utf8',
    });
    assert(result.status === 0, 'deployment evidence readiness manifest must pass verify-runtime-readiness-bundle.js: ' + (result.stdout + result.stderr).trim());
  }
  const readinessJson = JSON.parse(fs.readFileSync(readinessFile, 'utf8'));
  assert(readinessJson.status === 'ready-for-owner-approval', 'deployment evidence readiness manifest must be ready-for-owner-approval');
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    assert(readiness.serviceHeads && readiness.serviceHeads[service] === deployment.services?.[service]?.commitSha, `deployment evidence readinessManifest ${service} head must match deployment commitSha`);
    assert(readinessJson.serviceHeads && readinessJson.serviceHeads[service] === deployment.services?.[service]?.commitSha, `deployment evidence readiness manifest file ${service} head must match deployment commitSha`);
  }
}

function validateDeploymentEvidence(filePath) {
  const deploymentText = fs.readFileSync(filePath, 'utf8');
  assertNoSecrets(deploymentText);
  const deployment = readJsonFile(filePath);
  assert(deployment.generatedFromCurrentHeads === true, 'deployment evidence must be generated from current service heads');
  assertReadinessManifestBinding(deployment, path.dirname(filePath));
  assert(String(deployment.completionReminder || '').includes('verify-stock-traceability-completion.js'), 'deployment evidence must include completion verifier reminder');
  const services = deployment.services || {};
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    const item = services[service];
    assert(item, `deployment evidence missing ${service} service evidence`);
    assert(isCommitSha(item.commitSha), `deployment evidence ${service} commitSha must be a 7-40 character hex SHA`);
    assert(item.commitSha === currentHeadForService(service), `deployment evidence ${service} commitSha must match current ${deploymentRepos[service]} HEAD ${currentHeadForService(service)}`);
    assert(hasText(item.deployCommand || './scripts/deploy.sh'), `deployment evidence ${service} deployCommand is required`);
    assert(isCompletedEvidenceText(item.healthEvidence), `deployment evidence ${service} healthEvidence must be completed and must not contain TODO`);
    assert(isCompletedEvidenceText(item.protectedEndpointEvidence), `deployment evidence ${service} protectedEndpointEvidence must be completed and must not contain TODO`);
    assert(/401|403/.test(item.protectedEndpointEvidence || ''), `deployment evidence ${service} protectedEndpointEvidence must include 401 or 403`);
    assertCleanWorktreeForService(service);
  }
  return deployment;
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

function writeReadinessManifest(dir, serviceHeads) {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'readiness-manifest.json');
  fs.writeFileSync(filePath, JSON.stringify({ status: 'ready-for-owner-approval', serviceHeads, artifacts: {} }, null, 2) + '\n');
  return { file: filePath, sha256: sha256File(filePath), status: 'verified', serviceHeads: { ...serviceHeads } };
}

function validDeploymentForRoot(root, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-deployment-readiness-'))) {
  const previousRoot = crossServiceRoot;
  crossServiceRoot = root;
  const serviceHeads = {
    warehouse: currentHeadForService('warehouse'),
    catalog: currentHeadForService('catalog'),
    suppliers: currentHeadForService('suppliers'),
  };
  const deployment = {
    generatedAt: new Date().toISOString(),
    generatedFromCurrentHeads: true,
    readinessManifest: writeReadinessManifest(dir, serviceHeads),
    completionReminder: 'Deployment evidence is valid only when verify-stock-traceability-completion.js passes against the generated runtime manifest.',
    services: {
      warehouse: {
        commitSha: serviceHeads.warehouse,
        deployCommand: './scripts/deploy.sh',
        healthEvidence: 'Warehouse /api/health returned 200 after deployment',
        protectedEndpointEvidence: 'Anonymous Warehouse topology returned 401',
      },
      catalog: {
        commitSha: serviceHeads.catalog,
        deployCommand: './scripts/deploy.sh',
        healthEvidence: 'Catalog /health returned 200 after deployment',
        protectedEndpointEvidence: 'Anonymous Catalog coverage returned 403',
      },
      suppliers: {
        commitSha: serviceHeads.suppliers,
        deployCommand: './scripts/deploy.sh',
        healthEvidence: 'Suppliers /api/health returned 200 after deployment',
        protectedEndpointEvidence: 'Anonymous Suppliers imports returned 401',
      },
    },
  };
  crossServiceRoot = previousRoot;
  return deployment;
}

function writeDeployment(dir, deployment) {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'deployment-evidence.json');
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2) + '\n');
  return filePath;
}

function runSelfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-deployment-evidence-self-test-'));
  const root = path.join(dir, 'repos');
  for (const repo of Object.values(deploymentRepos)) initSelfTestRepo(root, repo);
  const previousRoot = crossServiceRoot;
  crossServiceRoot = root;

  const validFile = writeDeployment(dir, validDeploymentForRoot(root));
  const valid = validateDeploymentEvidence(validFile);
  assert(valid.generatedFromCurrentHeads === true, 'valid deployment evidence should pass');

  const stale = validDeploymentForRoot(root);
  stale.services.catalog.commitSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const staleFile = writeDeployment(path.join(dir, 'stale'), stale);
  let staleDeploymentHeadRejected = false;
  try {
    validateDeploymentEvidence(staleFile);
  } catch (error) {
    staleDeploymentHeadRejected = /catalog .*(?:commitSha|head) must match/.test(error.message);
  }
  assert(staleDeploymentHeadRejected, 'self-test must reject stale deployment service heads');

  const missingReadiness = validDeploymentForRoot(root, path.join(dir, 'missing-readiness-source'));
  delete missingReadiness.readinessManifest;
  const missingReadinessFile = writeDeployment(path.join(dir, 'missing-readiness'), missingReadiness);
  let missingReadinessRejected = false;
  try {
    validateDeploymentEvidence(missingReadinessFile);
  } catch (error) {
    missingReadinessRejected = /readinessManifest binding is required/.test(error.message);
  }
  assert(missingReadinessRejected, 'self-test must reject deployment evidence without readiness manifest binding');

  const weakAuth = validDeploymentForRoot(root);
  weakAuth.services.warehouse.protectedEndpointEvidence = 'Anonymous Warehouse topology returned 200';
  const weakAuthFile = writeDeployment(path.join(dir, 'weak-auth'), weakAuth);
  let missingProtectedEndpointRejected = false;
  try {
    validateDeploymentEvidence(weakAuthFile);
  } catch (error) {
    missingProtectedEndpointRejected = /protectedEndpointEvidence must include 401 or 403/.test(error.message);
  }
  assert(missingProtectedEndpointRejected, 'self-test must reject protected endpoint evidence without 401 or 403');

  const placeholder = validDeploymentForRoot(root);
  placeholder.services.suppliers.healthEvidence = 'TODO: record Suppliers /api/health';
  const placeholderFile = writeDeployment(path.join(dir, 'placeholder'), placeholder);
  let placeholderEvidenceRejected = false;
  try {
    validateDeploymentEvidence(placeholderFile);
  } catch (error) {
    placeholderEvidenceRejected = /healthEvidence must be completed/.test(error.message);
  }
  assert(placeholderEvidenceRejected, 'self-test must reject TODO deployment evidence');

  fs.writeFileSync(path.join(repoPathForService('suppliers'), 'dirty.txt'), 'dirty\n');
  let dirtyDeploymentRootRejected = false;
  try {
    validateDeploymentEvidence(validFile);
  } catch (error) {
    dirtyDeploymentRootRejected = /worktree must be clean/.test(error.message);
  }
  assert(dirtyDeploymentRootRejected, 'self-test must reject deployment evidence against dirty service worktrees');

  crossServiceRoot = previousRoot;
  console.log(JSON.stringify({
    status: 'passed',
    staleDeploymentHeadRejected,
    missingReadinessRejected,
    missingProtectedEndpointRejected,
    placeholderEvidenceRejected,
    dirtyDeploymentRootRejected,
  }, null, 2));
}

try {
  if (selfTest) {
    runSelfTest();
    process.exit(0);
  }
  const filePath = fileArg || process.env.DEPLOYMENT_EVIDENCE_FILE;
  const deployment = validateDeploymentEvidence(filePath);
  console.log(JSON.stringify({
    status: 'verified',
    deploymentEvidenceFile: filePath,
    services: Object.keys(deployment.services || {}),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
