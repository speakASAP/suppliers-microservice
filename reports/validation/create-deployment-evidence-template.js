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

function commitShaFor(repo) {
  if (selfTest) return '0'.repeat(40);
  const repoPath = path.join(root, repo);
  assert(fs.existsSync(repoPath), `Repository not found: ${repoPath}`);
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim();
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
    instructions: 'Replace TODO evidence with post-deploy health and anonymous protected-endpoint observations before using as DEPLOYMENT_EVIDENCE_FILE.',
    services,
  };
}

try {
  const template = buildTemplate();
  const output = JSON.stringify(template, null, 2) + '\n';
  if (selfTest) {
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
