#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
let crossServiceRoot = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const deploymentRepos = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath, label) {
  assert(fs.existsSync(filePath), `${label} does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function repoPathForService(service) {
  const repo = deploymentRepos[service];
  assert(repo, `Unknown service in manifest: ${service}`);
  const repoPath = path.join(crossServiceRoot, repo);
  assert(fs.existsSync(repoPath), `Repository not found for ${service}: ${repoPath}`);
  return repoPath;
}

function currentHeadForService(service) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPathForService(service), encoding: 'utf8' }).trim();
}

function assertCleanWorktreeForService(service) {
  const status = execFileSync('git', ['status', '--short'], { cwd: repoPathForService(service), encoding: 'utf8' }).trim();
  assert(!status, `${deploymentRepos[service]} worktree must be clean before runtime evidence manifest can prove completion`);
}

function fileEvidence(filePath) {
  assert(fs.existsSync(filePath), `manifest artifact does not exist: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  return {
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function validateArtifact(manifest, key) {
  const artifact = manifest.artifacts?.[key];
  assert(artifact, `manifest missing artifact ${key}`);
  assert(typeof artifact.file === 'string' && artifact.file.trim(), `manifest artifact ${key} missing file path`);
  assert(Number.isInteger(artifact.bytes) && artifact.bytes > 0, `manifest artifact ${key} bytes must be positive`);
  assert(/^[0-9a-f]{64}$/i.test(artifact.sha256 || ''), `manifest artifact ${key} sha256 must be a 64-character hex digest`);
  const actual = fileEvidence(artifact.file);
  assert(actual.bytes === artifact.bytes, `manifest artifact ${key} bytes mismatch`);
  assert(actual.sha256 === artifact.sha256, `manifest artifact ${key} sha256 mismatch`);
}

function verifyManifest(manifestFile) {
  const manifest = readJson(manifestFile, 'runtime evidence manifest');
  assert(manifest.status === 'runtime-complete-evidence-bundle', 'manifest status must be runtime-complete-evidence-bundle');
  assert(typeof manifest.generatedAt === 'string' && manifest.generatedAt.trim(), 'manifest generatedAt is required');
  assert(!Number.isNaN(Date.parse(manifest.generatedAt)), 'manifest generatedAt must be an ISO-compatible timestamp');
  for (const service of ['warehouse', 'catalog', 'suppliers']) {
    const head = manifest.serviceHeads?.[service];
    assert(/^[0-9a-f]{7,40}$/i.test(head || ''), `manifest ${service} head must be a commit SHA`);
    assert(head === currentHeadForService(service), `manifest ${service} head must match current ${deploymentRepos[service]} HEAD`);
    assertCleanWorktreeForService(service);
  }
  for (const artifact of ['fixture', 'smoke', 'deployment', 'approval', 'report']) {
    validateArtifact(manifest, artifact);
  }
  return { status: 'passed', manifestFile, artifacts: Object.keys(manifest.artifacts || {}).length };
}

function initSelfTestRepo(root, repo) {
  const repoPath = path.join(root, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.writeFileSync(path.join(repoPath, "README.md"), `# ${repo}\n`);
  execFileSync("git", ["init"], { cwd: repoPath, stdio: "pipe" });
  execFileSync("git", ["add", "README.md"], { cwd: repoPath, stdio: "pipe" });
  execFileSync("git", ["-c", "user.email=codex@example.invalid", "-c", "user.name=Codex", "commit", "-m", "self-test repo"], { cwd: repoPath, stdio: "pipe" });
  return repoPath;
}

function runSelfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stock-traceability-manifest-verify-"));
  const previousRoot = crossServiceRoot;
  crossServiceRoot = path.join(dir, "repos");
  for (const repo of Object.values(deploymentRepos)) {
    initSelfTestRepo(crossServiceRoot, repo);
  }
  const files = {
    fixture: path.join(dir, "fixture.json"),
    smoke: path.join(dir, "smoke.json"),
    deployment: path.join(dir, "deployment.json"),
    approval: path.join(dir, "approval.json"),
    report: path.join(dir, "report.md"),
  };
  fs.writeFileSync(files.fixture, JSON.stringify({ status: "fixture-ready" }));
  fs.writeFileSync(files.smoke, JSON.stringify({ status: "passed-runtime" }));
  fs.writeFileSync(files.deployment, JSON.stringify({ services: deploymentRepos }));
  fs.writeFileSync(files.approval, JSON.stringify({ id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL', status: 'approved' }));
  fs.writeFileSync(files.report, "# Runtime report\n- status: passed-runtime\n");
  const artifacts = {};
  for (const [key, artifactFile] of Object.entries(files)) {
    artifacts[key] = { file: artifactFile, ...fileEvidence(artifactFile) };
  }
  const manifestFile = path.join(dir, "manifest.json");
  fs.writeFileSync(manifestFile, JSON.stringify({
    status: "runtime-complete-evidence-bundle",
    generatedAt: new Date().toISOString(),
    serviceHeads: {
      warehouse: currentHeadForService("warehouse"),
      catalog: currentHeadForService("catalog"),
      suppliers: currentHeadForService("suppliers"),
    },
    artifacts,
  }, null, 2));
  const passed = verifyManifest(manifestFile);

  const tamperedFile = path.join(dir, "tampered-manifest.json");
  const tampered = readJson(manifestFile, "self-test manifest");
  tampered.artifacts.report.sha256 = "0".repeat(64);
  fs.writeFileSync(tamperedFile, JSON.stringify(tampered, null, 2));
  let tamperedHashRejected = false;
  try {
    verifyManifest(tamperedFile);
  } catch (error) {
    tamperedHashRejected = /sha256 mismatch/.test(error.message);
  }
  assert(tamperedHashRejected, "manifest verifier self-test must reject tampered artifact hash");

  fs.writeFileSync(path.join(repoPathForService("suppliers"), "dirty.txt"), "dirty\n");
  let dirtyWorktreeRejected = false;
  try {
    verifyManifest(manifestFile);
  } catch (error) {
    dirtyWorktreeRejected = /worktree must be clean/.test(error.message);
  }
  assert(dirtyWorktreeRejected, "manifest verifier self-test must reject dirty service worktrees");
  crossServiceRoot = previousRoot;
  return { ...passed, cleanWorktreeRequired: true, tamperedHashRejected: true, dirtyWorktreeRejected: true };
}

try {
  const result = selfTest
    ? runSelfTest()
    : verifyManifest(process.env.RUNTIME_EVIDENCE_MANIFEST || process.argv[2] || path.join(process.env.RUNTIME_EVIDENCE_DIR || '/tmp/stock-traceability-runtime', 'stock-traceability-runtime-evidence-manifest.json'));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
