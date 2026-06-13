#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const outputFile = process.env.DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT || '/tmp/stock-traceability-deployment-evidence.template.json';
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';

const serviceConfig = {
  warehouse: {
    repo: 'warehouse-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEvidencePlaceholder: 'TODO: record /api/health response after deployment',
    protectedEndpointEvidencePlaceholder: 'TODO: record anonymous protected endpoint rejection after deployment',
  },
  catalog: {
    repo: 'catalog-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEvidencePlaceholder: 'TODO: record /health response after deployment',
    protectedEndpointEvidencePlaceholder: 'TODO: record anonymous protected endpoint rejection after deployment',
  },
  suppliers: {
    repo: 'suppliers-microservice',
    deployCommand: './scripts/deploy.sh',
    healthEvidencePlaceholder: 'TODO: record /api/health response after deployment',
    protectedEndpointEvidencePlaceholder: 'TODO: record anonymous protected endpoint rejection after deployment',
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
  if (selfTest) return;
  const status = execFileSync('git', ['status', '--short'], { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
  assert(!status, `${repo} worktree must be clean before generating deployment evidence`);
}

function commitShaFor(repo) {
  if (selfTest) return '0'.repeat(40);
  assertCleanWorktree(repo);
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPathFor(repo), encoding: 'utf8' }).trim();
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
  const template = buildTemplate();
  const output = JSON.stringify(template, null, 2) + '\n';
  if (selfTest) {
    assert(template.generatedFromCurrentHeads === true, "self-test current-head marker missing");
    assert(template.instructions.includes("Regenerate this template after any Warehouse, Catalog, or Suppliers commit"), "self-test regeneration instruction missing");
    assert(template.completionReminder.includes("verify-stock-traceability-completion.js"), "self-test completion reminder missing");
    assert(template.services.warehouse.commitSha.length === 40, 'self-test warehouse SHA missing');
    assert(template.services.catalog.deployCommand === './scripts/deploy.sh', 'self-test deploy command missing');
    assert(template.services.suppliers.protectedEndpointEvidence.includes('TODO'), 'self-test should keep protected endpoint TODO');
    console.log(JSON.stringify({ status: 'passed', services: Object.keys(template.services) }, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, output);
    console.log(JSON.stringify({ status: 'written', outputFile, services: Object.keys(template.services) }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
