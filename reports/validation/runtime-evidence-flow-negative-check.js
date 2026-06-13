#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
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
    const sourcePath = path.join(crossServiceRoot, repo);
    const repoPath = path.join(root, repo);
    execFileSync('git', ['clone', '--quiet', sourcePath, repoPath], { encoding: 'utf8' });
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
  TRACE_SUPPLIER_STOCK_QTY: '7',
  TRACE_SUPPLIER_SKU: 'SUP-SKU-TRACE',
};

function writeDeploymentEvidence(overrides = {}, mutateDeployment = null, root = crossServiceRoot) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-flow-deployment-'));
  const serviceHeads = {
    warehouse: currentHeadForService('warehouse', root),
    catalog: currentHeadForService('catalog', root),
    suppliers: currentHeadForService('suppliers', root),
  };
  const readinessManifest = writeReadinessManifestForApproval(dir, serviceHeads, root);
  const deployment = {
    generatedAt: new Date().toISOString(),
    generatedFromCurrentHeads: true,
    readinessManifest,
    completionReminder: 'Deployment evidence is valid only when verify-stock-traceability-completion.js passes against the generated runtime manifest.',
    services: {
      warehouse: {
        commitSha: serviceHeads.warehouse,
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous topology returned 401',
      },
      catalog: {
        commitSha: serviceHeads.catalog,
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/health passed',
        protectedEndpointEvidence: 'anonymous coverage returned 401',
      },
      suppliers: {
        commitSha: serviceHeads.suppliers,
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

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeApprovalRequestForApproval(dir, serviceHeads) {
  const filePath = path.join(dir, 'runtime-approval-request.md');
  const heads = Object.entries(serviceHeads).map(([service, head]) => service + ':' + head).join('\n');
  fs.writeFileSync(filePath, 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST\n' + heads + '\napprovedTraceInputs TRACE_PRODUCT_ID TRACE_SUPPLIER_ID TRACE_IMPORT_IDEMPOTENCY_KEY TRACE_SUPPLIER_STOCK_QTY TRACE_SUPPLIER_SKU TRACE_CLEANUP_EVIDENCE\n');
  return {
    id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    file: filePath,
    sha256: fileSha256(filePath),
    serviceHeads: { ...serviceHeads },
  };
}

function writeReadinessManifestForApproval(dir, serviceHeads, root = crossServiceRoot) {
  const bundleDir = path.join(dir, 'readiness');
  const result = spawnSync(process.execPath, ['reports/validation/create-runtime-readiness-bundle.js'], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CROSS_SERVICE_ROOT: root,
      RUNTIME_READINESS_BUNDLE_DIR: bundleDir,
    },
    encoding: 'utf8',
  });
  assert(result.status === 0, 'runtime approval helper should generate a verified readiness bundle: ' + (result.stdout + result.stderr).trim());
  const filePath = path.join(bundleDir, 'stock-traceability-runtime-readiness-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const approvalRequest = manifest.artifacts && manifest.artifacts.approvalRequest;
  return {
    file: filePath,
    sha256: fileSha256(filePath),
    status: 'verified',
    serviceHeads: { ...serviceHeads },
    approvalRequest: approvalRequest && { id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', ...approvalRequest, serviceHeads: { ...serviceHeads } },
  };
}

function writeRuntimeApprovalArtifact(root = crossServiceRoot, mutateApproval = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-trace-flow-approval-'));
  const serviceHeads = {
    warehouse: currentHeadForService('warehouse', root),
    catalog: currentHeadForService('catalog', root),
    suppliers: currentHeadForService('suppliers', root),
  };
  const readinessManifest = writeReadinessManifestForApproval(dir, serviceHeads, root);
  const approval = {
    id: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL',
    status: 'approved',
    approvalRequestId: 'STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST',
    approvalRequest: readinessManifest.approvalRequest,
    approvedBy: 'owner@example.test',
    approvedAt: new Date().toISOString(),
    approvedForCurrentCleanHeads: true,
    serviceHeads: { ...serviceHeads },
    readinessManifest,
    approvedTraceInputs: {
      TRACE_PRODUCT_ID: baseEnv.TRACE_PRODUCT_ID,
      TRACE_PRODUCT_SKU_PREFIX: baseEnv.TRACE_PRODUCT_SKU_PREFIX,
      TRACE_SUPPLIER_ID: 'supplier-synthetic',
      TRACE_OWN_WAREHOUSE_ID: baseEnv.TRACE_OWN_WAREHOUSE_ID,
      TRACE_SUPPLIER_WAREHOUSE_ID: baseEnv.TRACE_SUPPLIER_WAREHOUSE_ID,
      TRACE_DROPSHIP_WAREHOUSE_ID: baseEnv.TRACE_DROPSHIP_WAREHOUSE_ID,
      TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
      TRACE_SUPPLIER_STOCK_QTY: baseEnv.TRACE_SUPPLIER_STOCK_QTY,
      TRACE_SUPPLIER_SKU: baseEnv.TRACE_SUPPLIER_SKU,
      TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    },
    scope: {
      syntheticSkuPrefix: 'CODEX-STOCK-TRACE-',
      syntheticRecordsOnly: true,
      oneGuardedSyntheticImport: true,
      runApprovedRuntimeSmoke: true,
      ownerApproval: 'explicit',
      smokeAllowMutation: true,
    },
    forbiddenActionsAcknowledged: [
      'real supplier imports',
      'production payload ingestion',
      'customer data capture',
      'hard deletes',
      'compensating stock changes',
      'token disclosure',
    ],
  };
  if (mutateApproval) mutateApproval(approval);
  const filePath = path.join(dir, 'runtime-approval.json');
  fs.writeFileSync(filePath, JSON.stringify(approval, null, 2));
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
  const env = {
    ...baseEnv,
    ...envPatch,
  };
  if (env.RUN_APPROVED_RUNTIME_SMOKE === 'true' && !Object.prototype.hasOwnProperty.call(envPatch, 'RUNTIME_APPROVAL_ARTIFACT_FILE')) {
    env.RUNTIME_APPROVAL_ARTIFACT_FILE = writeRuntimeApprovalArtifact(env.CROSS_SERVICE_ROOT || crossServiceRoot);
  }
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
  assert(result.status !== 0, name + " should fail");
  const output = result.stdout + result.stderr;
  assert(output.includes(expectedText), name + " should mention " + expectedText);
  return name;
}

const cases = [
  runPassCase('approval-artifact-self-test-rejects-stale-or-dirty-approval', ['reports/validation/verify-runtime-approval-artifact.js', '--self-test'], 'mismatchedApprovalHeadRejected'),
  runPassCase('approval-artifact-generator-self-test-requires-explicit-owner-approval', ['reports/validation/create-runtime-approval-artifact.js', '--self-test'], 'missingApprovalRejected'),
  runPassCase('deployment-evidence-generator-self-test-rejects-missing-or-weak-evidence', ['reports/validation/create-deployment-evidence.js', '--self-test'], 'weakProtectedEvidenceRejected'),
  runPassCase('deployment-evidence-verifier-self-test-rejects-stale-or-placeholder-evidence', ['reports/validation/verify-deployment-evidence.js', '--self-test'], 'placeholderEvidenceRejected'),
  runPassCase('deployment-evidence-verifier-self-test-rejects-non-canonical-generated-at', ['reports/validation/verify-deployment-evidence.js', '--self-test'], 'nonCanonicalDeploymentGeneratedAtRejected'),
  runPassCase('runtime-readiness-bundle-self-test-rejects-dirty-or-stale-artifacts', ['reports/validation/create-runtime-readiness-bundle.js', '--self-test'], 'missingManifestVerificationRejected'),
  runPassCase('runtime-readiness-verifier-self-test-rejects-tampering-or-stale-heads', ['reports/validation/verify-runtime-readiness-bundle.js', '--self-test'], 'staleHeadRejected'),
  runPassCase('runtime-readiness-verifier-self-test-rejects-non-canonical-generated-at', ['reports/validation/verify-runtime-readiness-bundle.js', '--self-test'], 'nonCanonicalReadinessGeneratedAtRejected'),
  runPassCase('manifest-self-test-writes-hashed-evidence', ['--manifest-self-test'], 'manifest-self-test-passed'),
  runPassCase('runtime-report-verifier-self-test-rejects-placeholder-assertions', ['reports/validation/verify-runtime-evidence-report.js', '--self-test'], 'placeholderAssertionRejected'),
  runPassCase('manifest-verifier-self-test-rejects-non-canonical-generated-at', ['reports/validation/verify-runtime-evidence-manifest.js', '--self-test'], 'nonCanonicalGeneratedAtRejected'),
  runPassCase('manifest-verifier-self-test-rejects-tampering', ['reports/validation/verify-runtime-evidence-manifest.js', '--self-test'], 'tamperedHashRejected'),
  runPassCase('manifest-bundle-self-test-cross-checks-deployment', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'deploymentManifestMismatchRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mixed-trace-product', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mixedTraceProductRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mixed-supplier-warehouse', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mixedSupplierWarehouseRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mismatched-supplier-id', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mismatchedSupplierRejected'),
  runPassCase('manifest-bundle-self-test-rejects-missing-catalog-own-route', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'missingCatalogOwnRouteRejected'),
  runPassCase('manifest-bundle-self-test-rejects-non-reservable-supplier-route', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'nonReservableSupplierRouteRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mismatched-supplier-job-fingerprint', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mismatchedSupplierJobFingerprintRejected'),
  runPassCase('manifest-bundle-self-test-rejects-missing-supplier-job-catalog-validation', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'missingSupplierJobCatalogValidationRejected'),
  runPassCase('manifest-bundle-self-test-rejects-mismatched-stock-authority', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'mismatchedStockAuthorityRejected'),
  runPassCase('manifest-bundle-self-test-rejects-cleanup-placeholder', ['reports/validation/verify-runtime-evidence-bundle.js', '--self-test'], 'cleanupPlaceholderRejected'),
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
  runCase('approved-smoke-missing-runtime-approval-artifact', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    RUNTIME_APPROVAL_ARTIFACT_FILE: '',
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'RUNTIME_APPROVAL_ARTIFACT_FILE'),
  runCase('approved-smoke-runtime-approval-head-not-current', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    RUNTIME_APPROVAL_ARTIFACT_FILE: writeRuntimeApprovalArtifact(crossServiceRoot, (approval) => {
      const staleCatalogHead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const currentCatalogHead = currentHeadForService('catalog', crossServiceRoot);
      approval.serviceHeads.catalog = staleCatalogHead;
      approval.approvalRequest.serviceHeads.catalog = staleCatalogHead;
      const requestText = fs.readFileSync(approval.approvalRequest.file, 'utf8').replace(currentCatalogHead, staleCatalogHead);
      fs.writeFileSync(approval.approvalRequest.file, requestText);
      approval.approvalRequest.bytes = fs.statSync(approval.approvalRequest.file).size;
      approval.approvalRequest.sha256 = fileSha256(approval.approvalRequest.file);
      const readiness = JSON.parse(fs.readFileSync(approval.readinessManifest.file, 'utf8'));
      readiness.serviceHeads.catalog = staleCatalogHead;
      readiness.artifacts.approvalRequest = approval.approvalRequest;
      fs.writeFileSync(approval.readinessManifest.file, JSON.stringify(readiness, null, 2));
      approval.readinessManifest.serviceHeads.catalog = staleCatalogHead;
      approval.readinessManifest.sha256 = fileSha256(approval.readinessManifest.file);
    }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'head must match'),
  runCase('approved-smoke-trace-inputs-differ-from-approval', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_SUPPLIER_STOCK_QTY: '8',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'approved runtime smoke trace inputs must match'),
  runCase('low-level-smoke-rejects-zero-supplier-stock-qty', {
    TRACE_RUN_SUPPLIERS_IMPORT: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_SUPPLIER_STOCK_QTY: '0',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'TRACE_SUPPLIER_STOCK_QTY must be a positive integer', ['reports/validation/runtime-stock-traceability-smoke.js', '--config-only']),
  runCase('low-level-smoke-rejects-placeholder-cleanup-evidence', {
    TRACE_RUN_SUPPLIERS_IMPORT: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'placeholder cleanup evidence after run',
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'TRACE_CLEANUP_EVIDENCE must be completed', ['reports/validation/runtime-stock-traceability-smoke.js', '--config-only']),
  runCase('approved-smoke-cleanup-evidence-differs-from-approval', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:other-cleanup-reference',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'approved runtime smoke trace inputs must match'),
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
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ warehouse: { commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'warehouse head must match deployment commitSha'),
  runCase('approved-smoke-deployment-sha-not-current-head', {
    RUN_APPROVED_RUNTIME_SMOKE: 'true',
    TRACE_SUPPLIER_ID: 'supplier-synthetic',
    TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
    TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ catalog: { commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } }, (deployment) => {
      const staleCatalogHead = deployment.services.catalog.commitSha;
      const currentCatalogHead = currentHeadForService('catalog', crossServiceRoot);
      deployment.readinessManifest.serviceHeads.catalog = staleCatalogHead;
      const readiness = JSON.parse(fs.readFileSync(deployment.readinessManifest.file, 'utf8'));
      readiness.serviceHeads.catalog = staleCatalogHead;
      const request = readiness.artifacts && readiness.artifacts.approvalRequest;
      if (request && request.file) {
        const requestText = fs.readFileSync(request.file, 'utf8').replace(currentCatalogHead, staleCatalogHead);
        fs.writeFileSync(request.file, requestText);
        request.bytes = fs.statSync(request.file).size;
        request.sha256 = fileSha256(request.file);
      }
      fs.writeFileSync(deployment.readinessManifest.file, JSON.stringify(readiness, null, 2));
      deployment.readinessManifest.sha256 = fileSha256(deployment.readinessManifest.file);
    }),
    OWNER_APPROVAL: 'explicit',
    SMOKE_ALLOW_MUTATION: 'true',
  }, 'deployment evidence verifier failed'),
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
    const dirtyRoot = createCleanCrossServiceRoot();
    const deploymentEvidenceFile = writeDeploymentEvidence({}, null, dirtyRoot);
    const approvalArtifactFile = writeRuntimeApprovalArtifact(dirtyRoot);
    fs.writeFileSync(path.join(dirtyRoot, deploymentRepos.catalog, 'dirty.txt'), 'uncommitted catalog change\n');
    return runCase('approved-smoke-dirty-service-worktree', {
      CROSS_SERVICE_ROOT: dirtyRoot,
      RUN_APPROVED_RUNTIME_SMOKE: 'true',
      TRACE_SUPPLIER_ID: 'supplier-synthetic',
      TRACE_IMPORT_IDEMPOTENCY_KEY: 'manual:traceability-synthetic',
      TRACE_CLEANUP_EVIDENCE: 'deferred:traceability-runbook',
      DEPLOYMENT_EVIDENCE_FILE: deploymentEvidenceFile,
      RUNTIME_APPROVAL_ARTIFACT_FILE: approvalArtifactFile,
      OWNER_APPROVAL: 'explicit',
      SMOKE_ALLOW_MUTATION: 'true',
    }, 'dirty services: catalog-microservice');
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
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ suppliers: { healthEvidence: 'placeholder /api/health response after deployment' } }),
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
    }, 'deployment evidence verifier failed');
  })(),
  runCase("approved-smoke-execution-validates-approval-before-fixture", {
    RUN_APPROVED_RUNTIME_SMOKE: "true",
    TRACE_SUPPLIER_ID: "supplier-synthetic",
    TRACE_IMPORT_IDEMPOTENCY_KEY: "manual:traceability-synthetic",
    TRACE_CLEANUP_EVIDENCE: "deferred:traceability-runbook",
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence(),
    RUNTIME_APPROVAL_ARTIFACT_FILE: writeRuntimeApprovalArtifact(crossServiceRoot, (approval) => {
      approval.scope.syntheticRecordsOnly = false;
    }),
    OWNER_APPROVAL: "explicit",
    SMOKE_ALLOW_MUTATION: "true",
  }, "syntheticRecordsOnly", []),
  runCase("approved-smoke-execution-validates-deployment-before-fixture", {
    RUN_APPROVED_RUNTIME_SMOKE: "true",
    TRACE_SUPPLIER_ID: "supplier-synthetic",
    TRACE_IMPORT_IDEMPOTENCY_KEY: "manual:traceability-synthetic",
    TRACE_CLEANUP_EVIDENCE: "deferred:traceability-runbook",
    DEPLOYMENT_EVIDENCE_FILE: writeDeploymentEvidence({ warehouse: { commitSha: "not-a-sha" } }),
    OWNER_APPROVAL: "explicit",
    SMOKE_ALLOW_MUTATION: "true",
  }, "deployment evidence verifier failed", []),
];

console.log(JSON.stringify({ status: 'passed', cases }, null, 2));
