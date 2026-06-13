#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const crossServiceRoot = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const deploymentRepos = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function currentHeadForService(service) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: path.join(crossServiceRoot, deploymentRepos[service]),
    encoding: 'utf8',
  }).trim();
}

const baseEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  WAREHOUSE_URL: 'http://warehouse.example.test',
  CATALOG_URL: 'http://catalog.example.test',
  SUPPLIERS_URL: 'http://suppliers.example.test',
  CATALOG_TOKEN: 'catalog-token-synthetic',
  WAREHOUSE_TOKEN: 'warehouse-token-synthetic',
  SUPPLIERS_TOKEN: 'suppliers-token-synthetic',
  TRACE_PRODUCT_ID: 'product-synthetic',
  TRACE_PRODUCT_SKU_PREFIX: 'CODEX-STOCK-TRACE-',
  TRACE_OWN_WAREHOUSE_ID: 'warehouse-own',
  TRACE_SUPPLIER_WAREHOUSE_ID: 'warehouse-supplier',
  TRACE_DROPSHIP_WAREHOUSE_ID: 'warehouse-dropship',
};

function writeDeploymentEvidence(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-flow-deployment-'));
  const deployment = {
    services: {
      warehouse: {
        commitSha: currentHeadForService('warehouse'),
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous topology returned 401',
      },
      catalog: {
        commitSha: currentHeadForService('catalog'),
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/health passed',
        protectedEndpointEvidence: 'anonymous coverage returned 401',
      },
      suppliers: {
        commitSha: currentHeadForService('suppliers'),
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous imports returned 401',
      },
    },
  };
  for (const [service, patch] of Object.entries(overrides)) {
    deployment.services[service] = patch === null ? undefined : { ...deployment.services[service], ...patch };
  }
  const filePath = path.join(dir, 'deployment.json');
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2));
  return filePath;
}

function createDeploymentEvidenceTemplate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-flow-template-'));
  const filePath = path.join(dir, 'deployment-template.json');
  const result = spawnSync(process.execPath, ['reports/validation/create-deployment-evidence-template.js'], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT: filePath,
    },
    encoding: 'utf8',
  });
  assert(result.status === 0, 'deployment evidence template generation should pass');
  return filePath;
}


function runPassCase(name, args, expectedText) {
  const commandArgs = args[0] && args[0].endsWith('.js') ? args : ["reports/validation/run-runtime-evidence-flow.js", ...args];
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: baseEnv,
    encoding: "utf8",
  });
  assert(result.status === 0, name + " should pass");
  const output = result.stdout + result.stderr;
  assert(output.includes(expectedText), name + " should mention " + expectedText);
  return name;
}

function runCase(name, envPatch, expectedText, args = ["--config-only"]) {
  const commandArgs = args[0] && args[0].endsWith('.js') ? args : ["reports/validation/run-runtime-evidence-flow.js", ...args];
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...baseEnv,
      ...envPatch,
    },
    encoding: "utf8",
  });
  assert(result.status !== 0, name + " should fail");
  const output = result.stdout + result.stderr;
  assert(output.includes(expectedText), name + " should mention " + expectedText);
  return name;
}

const cases = [
  runPassCase('manifest-self-test-writes-hashed-evidence', ['--manifest-self-test'], 'manifest-self-test-passed'),
  runPassCase('manifest-verifier-self-test-rejects-tampering', ['reports/validation/verify-runtime-evidence-manifest.js', '--self-test'], 'tamperedHashRejected'),
  runPassCase('manifest-bundle-self-test-cross-checks-deployment', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'deploymentManifestMismatchRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mixed-trace-product', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mixedTraceProductRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mixed-supplier-warehouse', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mixedSupplierWarehouseRejected'),
  runCase('approved-smoke-missing-deployment-evidence', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
    DEPLOYMENT_EVIDENCE_FILE: '',
  }, 'DEPLOYMENT_EVIDENCE_FILE'),
  runCase('approved-smoke-missing-owner-approval', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    OWNER_APPROVAL: '',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'OWNER_APPROVAL=explicit'),
  runCase('approved-smoke-missing-mutation-allowance', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: '',
  }, 'SMOKE_ALLOW_MUTATION=true'),
  runCase('approved-smoke-invalid-deployment-evidence', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ warehouse: { commitSha: 'not-a-sha' } }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'warehouse commitSha'),
  runCase('approved-smoke-deployment-sha-not-current-head', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ catalog: { commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'catalog commitSha must match current'),
  runCase('approved-smoke-missing-protected-endpoint-evidence', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ catalog: { protectedEndpointEvidence: 'anonymous coverage returned 200' } }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'catalog protectedEndpointEvidence'),
  runCase('approved-smoke-health-evidence-still-placeholder', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ suppliers: { healthEvidence: 'TODO: record /api/health response after deployment' } }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'suppliers healthEvidence'),
  runCase('approved-smoke-template-not-complete-evidence', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: createDeploymentEvidenceTemplate(),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'warehouse healthEvidence'),
  runCase("approved-smoke-execution-validates-deployment-before-fixture", {
    RUN_APPROVED_RUNTIME_SMOKE: "true",
    TRACE_SUPPLIER_ID: "supplier-synthetic",
    TRACE_IMPORT_IDEMPOTENCY_KEY: "manual:traceability-synthetic",
    TRACE_CLEANUP_EVIDENCE: "deferred:traceability-runbook",
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ warehouse: { commitSha: "not-a-sha" } }),
    OWNER_APPROVAL: "explicit",
    SMOKE_ALLOW_MUTATION: "true",
  }, "warehouse commitSha", []),
];

console.log(JSON.stringify({ status: 'passed', cases }, null, 2));
