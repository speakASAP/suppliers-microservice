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

function currentHeadForService(service, root = crossServiceRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: path.join(root, deploymentRepos[service]),
    encoding: 'utf8',
  }).trim();
}

function git(repoPath, args) {
  return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8' }).trim();
}

function createCleanCrossServiceRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-root-'));
  for (const repo of Object.values(deploymentRepos)) {
    const repoPath = path.join(root, repo);
    fs.mkdirSync(repoPath, { recursive: true });
    git(repoPath, ['init']);
    fs.writeFileSync(path.join(repoPath, 'README.md'), repo + '\n');
    git(repoPath, ['add', 'README.md']);
    git(repoPath, ['-c', 'user.email=traceability@example.test', '-c', 'user.name=Traceability Check', 'commit', '-m', 'Initial traceability fixture']);
  }
  return root;
}

function createDirtyCrossServiceRoot() {
  const root = createCleanCrossServiceRoot();
  fs.writeFileSync(path.join(root, deploymentRepos.catalog, 'dirty.txt'), 'uncommitted catalog change\n');
  return root;
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

function writeDeploymentEvidence(overrides = {}, mutateDeployment = null, root = crossServiceRoot) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-flow-deployment-'));
  const deployment = {
    generatedFromCurrentHeads: true,
    completionReminder: 'Deployment evidence is valid only when verify-stock-traceability-completion.js passes against the generated runtime manifest.',
    services: {
      warehouse: {
        commitSha: currentHeadForService('warehouse', root),
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous topology returned 401',
      },
      catalog: {
        commitSha: currentHeadForService('catalog', root),
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/health passed',
        protectedEndpointEvidence: 'anonymous coverage returned 401',
      },
      suppliers: {
        commitSha: currentHeadForService('suppliers', root),
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous imports returned 401',
      },
    },
  };
  for (const [service, patch] of Object.entries(overrides)) {
    deployment.services[service] = patch === null ? undefined : { ...deployment.services[service], ...patch };
  }
  if (mutateDeployment) mutateDeployment(deployment);
  const filePath = path.join(dir, 'deployment.json');
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2));
  return filePath;
}

function createDeploymentEvidenceTemplate(root = crossServiceRoot) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-flow-template-'));
  const filePath = path.join(dir, 'deployment-template.json');
  const result = spawnSync(process.execPath, ['reports/validation/create-deployment-evidence-template.js'], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT: filePath,
      CROSS_SERVICE_ROOT: root,
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
  runPassCase('manifest-bundle-self-test-rejects-mismatched-supplier-id', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mismatchedSupplierRejected'),
  runPassCase('manifest-bundle-self-test-rejects-missing-catalog-own-route', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'missingCatalogOwnRouteRejected'),
  runPassCase('manifest-bundle-self-test-rejects-non-reservable-supplier-route', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'nonReservableSupplierRouteRejected'),
  runPassCase('manifest-bundle-self-test-rejects-missing-supplier-job-catalog-validation', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'missingSupplierJobCatalogValidationRejected'),
  runPassCase('manifest-bundle-self-test-rejects-missing-projection-own-route', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'missingProjectionOwnRouteRejected'),
  runCase('approved-smoke-missing-own-warehouse-id', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_OWN_WAREHOUSE_ID: '',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'TRACE_OWN_WAREHOUSE_ID'),
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
  runCase('approved-smoke-missing-current-head-deployment-marker', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({}, (deployment) => {
      delete deployment.generatedFromCurrentHeads;
    }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'generated from current service heads'),
  (() => {
    const dirtyRoot = createDirtyCrossServiceRoot();
    return runCase('approved-smoke-dirty-service-worktree', {
      CROSS_SERVICE_ROOT: dirtyRoot,
      RUN_APPROVED_RUNTIME_SMOKE: 'true',
      TRACE_SUPPLIER_ID: 'supplier-synthetic',
      TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
      TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
      DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({}, null, dirtyRoot),
      OWNER_APPROVAL: 'explicit',
      SMOKE_ALLOW_MUTATION: 'true',
    }, 'catalog-microservice worktree must be clean');
  })(),
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
  (() => {
    const cleanRoot = createCleanCrossServiceRoot();
    return runCase('approved-smoke-template-not-complete-evidence', {
      CROSS_SERVICE_ROOT: cleanRoot,
      RUN_APPROVED_RUNTIME_SMOKE: 'true',
      TRACE_SUPPLIER_ID: 'supplier-synthetic',
      TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
      TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
      DEPLOYMENT_EVIDENCE_FILE: createDeploymentEvidenceTemplate(cleanRoot),
      OWNER_APPROVAL: 'explicit',
      SMOKE_ALLOW_MUTATION: 'true',
    }, 'warehouse healthEvidence');
  })(),
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
