#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const outputFile = process.env.DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT || '/tmp/stock-traceability-deployment-evidence.template.json';
let root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';

const serviceConfig = {
  warehouse: {
    repo: 'warehouse-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEvidencePlaceholder: 'TODO: record Warehouse /api/health passed after deployment',
    protectedEndpointEvidencePlaceholder: 'TODO: record anonymous Warehouse topology or logistics endpoint returned 401 or 403 after deployment',
  },
  catalog: {
    repo: 'catalog-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEvidencePlaceholder: 'TODO: record Catalog /health passed after deployment',
    protectedEndpointEvidencePlaceholder: 'TODO: record anonymous Catalog availability or coverage endpoint returned 401 or 403 after deployment',
  },
  suppliers: {
    repo: 'suppliers-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEvidencePlaceholder: 'TODO: record Suppliers /api/health passed after deployment',
    protectedEndpointEvidencePlaceholder: 'TODO: record anonymous Suppliers imports endpoint returned 401 or 403 after deployment',
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repoPathFor(repo) {
  const repoPath = path.join(root, repo);
  assert(fs.existsSync(repoPath), `Repository not found: ${repoPath}`);
  return repoPath;
}

function assertCleanWorktree(repo) {
  const status = execFileSync('git', ['status', '--short'], { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
  assert(!status, `${repo} worktree must be clean before generating deployment evidence`);
}

function commitShaFor(repo) {
  assertCleanWorktree(repo);
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
}

function initSelfTestRepo(repo) {
  const repoPath = path.join(root, repo);
  fs.mkdirSync(repoPath, { recursive: true });
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# ' + repo + '\n');
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.email=codex@example.invalid', '-c', 'user.name=Codex', 'commit', '-m', 'self-test repo'], { cwd: repoPath, stdio: 'pipe' });
  return repoPath;
}

function buildTemplate() {
  const services = {};
  for (const [name, config] of Object.entries(serviceConfig)) {
    services[name] = {
      commitSha: commitShaFor(config.repo),
      deployCommand: config.deployCommand,
      healthEvidence: config.healthEvidencePlaceholder,
      protectedEndpointEvidence: config.protectedEndpointEvidencePlaceholder,
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    generatedFromCurrentHeads: true,
    instructions: "Regenerate this template after any Warehouse, Catalog, or Suppliers commit. Replace TODO evidence with post-deploy health and anonymous protected-endpoint observations before using as DEPLOYMENT_EVIDENCE_FILE.",
    completionReminder: "Deployment evidence is valid only when each commitSha still matches the current remote repo HEAD and verify-stock-traceability-completion.js passes against the generated runtime manifest.",
    services,
  };
}

try {
  if (selfTest) {
    root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stock-traceability-deploy-template-')), 'repos');
    for (const config of Object.values(serviceConfig)) {
      initSelfTestRepo(config.repo);
    }
  }
  const template = buildTemplate();
  const output = JSON.stringify(template, null, 2) + '\n';
  if (selfTest) {
    assert(template.generatedFromCurrentHeads === true, "self-test current-head marker missing");
    assert(template.instructions.includes("Regenerate this template after any Warehouse, Catalog, or Suppliers commit"), "self-test regeneration instruction missing");
    assert(template.completionReminder.includes("verify-stock-traceability-completion.js"), "self-test completion reminder missing");
    assert(/^[0-9a-f]{40}$/.test(template.services.warehouse.commitSha), 'self-test warehouse SHA missing');
    assert(template.services.catalog.deployCommand === './scripts/deploy.sh', 'self-test deploy command missing');
    assert(template.services.warehouse.protectedEndpointEvidence.includes('401 or 403'), 'self-test warehouse protected endpoint guidance missing');
    assert(template.services.catalog.protectedEndpointEvidence.includes('401 or 403'), 'self-test catalog protected endpoint guidance missing');
    assert(template.services.suppliers.protectedEndpointEvidence.includes('401 or 403'), 'self-test suppliers protected endpoint guidance missing');
    fs.writeFileSync(path.join(repoPathFor(serviceConfig.suppliers.repo), 'dirty.txt'), 'dirty\n');
    let dirtyWorktreeRejected = false;
    try {
      buildTemplate();
    } catch (error) {
      dirtyWorktreeRejected = /worktree must be clean/.test(error.message);
    }
    assert(dirtyWorktreeRejected, 'deployment evidence template self-test must reject dirty service worktrees');
    console.log(JSON.stringify({ status: 'passed', services: Object.keys(template.services), dirtyWorktreeRejected }, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, output);
    console.log(JSON.stringify({ status: 'written', outputFile, services: Object.keys(template.services) }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
