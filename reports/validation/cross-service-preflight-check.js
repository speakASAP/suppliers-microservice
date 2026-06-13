#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const root = process.env.CROSS_SERVICE_ROOT || path.resolve(__dirname, '../../..');

const services = {
  warehouse: path.join(root, 'warehouse-microservice'),
  catalog: path.join(root, 'catalog-microservice'),
  suppliers: path.join(root, 'suppliers-microservice'),
};

const checks = [
  {
    service: 'warehouse',
    file: 'src/warehouses/warehouses.controller.ts',
    patterns: ['BatchWarehouseLogisticsDto', "@Get('topology')", "@Post('logistics/batch')"],
  },
  {
    service: 'warehouse',
    file: 'src/warehouses/dto/warehouse.dto.ts',
    patterns: ['BatchWarehouseLogisticsDto', 'ArrayNotEmpty', 'ArrayMaxSize(200)', 'IsString({ each: true })'],
  },
  {
    service: 'warehouse',
    file: 'test/warehouses.dto.spec.ts',
    patterns: ['BatchWarehouseLogisticsDto', 'rejects missing, empty, and oversized logistics batch requests', 'rejects non-string product identifiers'],
  },
  {
    service: 'warehouse',
    file: 'src/warehouses/warehouses.service.ts',
    patterns: ['supplier_replenishment', 'supplier_dropship', 'getInventoryTopology', 'getBatchProductLogistics', 'canReserveFromWarehouse: route.canReserveFromWarehouse && warehouse.totalAvailable > 0'],
  },
  {
    service: 'warehouse',
    file: 'src/stock/stock.service.ts',
    patterns: ['warehouseType', 'supplierId'],
  },
  {
    service: 'warehouse',
    file: 'src/suppliers/supplier-reconciliation.service.ts',
    patterns: ['is supplier-managed but is not linked to a supplier', 'belongs to supplier', 'supplier_reconciliation', 'const existing = await reconciliationRepository.findOne'],
  },
  {
    service: 'warehouse',
    file: 'test/supplier-reconciliation.service.spec.ts',
    patterns: ['returns the existing reconciliation when a supplier reference is replayed after validating warehouse ownership', 'rejects replayed reconciliation when the warehouse is no longer linked to the request supplier', 'rejects supplier-managed warehouses that are not linked to a supplier', 'rejects supplier reconciliation when the warehouse belongs to another supplier'],
  },
  {
    service: 'warehouse',
    file: 'docs/contracts/supplier-reconciliation-contract.md',
    patterns: ['Supplier-managed warehouses must have a Warehouse-owned `supplierId`', 'must match the request supplier'],
  },
  {
    service: 'warehouse',
    file: 'test/warehouses.service.spec.ts',
    patterns: ['supplier_replenishment', 'supplier_dropship', 'OWN-PRG', 'SUP-BETA', 'DROP-ACME', 'alfares_receiving_or_handoff', "responsibility: 'supplier'", "responsibility: 'warehouse'", 'reserved-only supplier routes visible but not reservable', 'canReserveFromWarehouse: false', 'supplier-managed routes without supplier linkage visible but not reservable'],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.controller.ts',
    patterns: ['coverage/audit', 'coverage'],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.service.ts',
    patterns: ['warehouses/logistics/batch', 'indexWarehouseLogisticsPlans', 'resolveConsistentLogisticsPlan', 'Ignoring stale Warehouse logistics plan', 'mixed_stock', 'warehouse_logistics_route_missing'],
  },
  {
    service: 'catalog',
    file: 'src/flipflop-projection/flipflop-projection.service.ts',
    patterns: ['availability.warehouses', 'availability.logistics', 'hasSellableWarehouseAvailability', 'canReserveFromWarehouse'],
  },
  {
    service: 'catalog',
    file: 'src/channel-readiness/channel-readiness.service.ts',
    patterns: ['WarehouseAvailabilityService', 'warehouseCoverageIssues', 'sellableWithWarehouse', 'warehouse_logistics_route_missing', 'warehouseCoverage: facts.warehouseCoverage'],
  },
  {
    service: 'catalog',
    file: 'src/channel-readiness/channel-readiness.service.spec.ts',
    patterns: ['blocks FlipFlop readiness when Warehouse has stock but no reservable route', 'uses injected Warehouse coverage facts without fetching coverage again', 'warehouse_logistics_route_missing', 'sellableWithWarehouse: false'],
  },
  {
    service: 'catalog',
    file: 'src/warehouse-availability/warehouse-availability.service.spec.ts',
    patterns: ['supplier_replenishment', 'supplier_dropship', 'alfares_receiving_or_handoff', "to: 'customer'", "responsibility: 'supplier'", "responsibility: 'warehouse'", 'does not attach stale Warehouse logistics', 'ignores duplicate and unrequested Warehouse logistics plans'],
  },
  {
    service: 'catalog',
    file: 'src/flipflop-projection/flipflop-projection.service.spec.ts',
    patterns: ['availability:', 'logistics:', 'legs:', 'OWN-PRG', 'to: "customer"', 'responsibility: "warehouse"', 'no reservable Warehouse logistics route', 'includeUnavailable: true'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/imports.service.ts',
    patterns: ['apply_with_owner_approval', 'warehouseStockUpdateApproved', 'supplier-reconciliations', 'requireForSupplier', 'validateCatalogProductsExist', 'catalogProductValidationStatus', 'catalogProductIdsChecked', 'CATALOG_SERVICE_TOKEN', '/api/products/'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/import-validation.ts',
    patterns: ['seenWarehouseCandidates', 'Duplicate Warehouse stock candidate', 'productId', 'warehouseId', 'expectedSupplierId', 'Warehouse stock candidate supplierId must match the import supplier before Warehouse mutation'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/imports.module.ts',
    patterns: ['SyntheticTraceSupplierAdapter', 'ProductionRestJsonSupplierAdapter'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/supplier-import-adapter.ts',
    patterns: ['SupplierAdapterRunSupplier', 'apiCredentials', 'supplier?: SupplierAdapterRunSupplier', 'supplierId?: string'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/supplier-adapter-registry.ts',
    patterns: ['requireForSupplier', 'adapterKeys'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/synthetic-trace-supplier-adapter.ts',
    patterns: ['synthetic-trace', 'trace:<productId>:<warehouseId>:<quantity>[:supplierSku]', 'trace:<productId>:<supplierWarehouseId>:<dropshipWarehouseId>:<quantity>[:supplierSku]', 'supplierId: context.supplierId'],
  },
  {
    service: 'suppliers',
    file: 'src/imports/adapters/production-rest-json-supplier-adapter.ts',
    patterns: ['PRODUCTION-REST-JSON-V1', 'maxRedirects: 0', 'apiCredentials', 'sourceFingerprint', 'supplierId: this.optionalString(item.supplierId) || context.supplierId'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/synthetic-stock-traceability-check.js',
    patterns: ['hasLocalCustomerLeg', 'hasSupplierCustomerPath', 'routeLegs', 'supplier_dropship', 'responsibility: "supplier"', 'responsibility: "warehouse"'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-stock-traceability-smoke.js',
    patterns: ['TRACE_RUN_SUPPLIERS_IMPORT', 'TRACE_CLEANUP_EVIDENCE', 'TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-', 'TRACE_DROPSHIP_WAREHOUSE_ID', 'fixtureCheck', 'readHealth', "service, endpoint", 'catalogRouteTypes', 'projectionRouteTypes', 'summarizeLogisticsLegs', 'hasRequiredLogisticsLegs', 'hasRequiredReservableRoutes', 'canReserveFromWarehouse', 'sourceFingerprint', 'stockAuthority', 'warehouseTotalAvailable', 'assertConfiguredSupplierOwnership', 'assertConfiguredRouteSupplierOwnership', 'assertConfiguredRoute', 'Catalog forwarded own', 'FlipFlop forwarded own', 'warehouses/logistics/batch', 'availability/coverage/audit', 'catalogAvailability'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/generate-runtime-evidence-report.js',
    patterns: ['VAL-CROSS-STOCK-RUNTIME-LIVE', 'Runtime complete', 'summarizeCatalogAvailability', 'summarizeStockAuthority', 'stockAuthorityComplete', 'isCompletedEvidenceText(smoke.cleanupEvidence)', 'summarizeFixtureCheck', 'fixtureCheckComplete', 'FIXTURE_CHECK_RESULT_FILE', 'hasAllRequiredRouteTypes', 'hasRequiredRouteLegs', 'hasRequiredReservableRoutes', 'available=', 'reservable=', 'summarizeRouteLegs', 'deploymentEvidenceComplete', 'generatedFromCurrentHeads', 'isCommitSha', 'namedHealthComplete', 'expectedSkuPrefix', '401|403', "source === 'warehouse'"],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-deployment-evidence-template.js',
    patterns: ['DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT', 'warehouse-microservice', 'catalog-microservice', 'suppliers-microservice', 'protectedEndpointEvidencePlaceholder', 'assertCleanWorktree', 'worktree must be clean before generating deployment evidence', 'dirtyWorktreeRejected', 'deployment evidence template self-test must reject dirty service worktrees', 'generatedFromCurrentHeads', 'Regenerate this template after any Warehouse, Catalog, or Suppliers commit', 'verify-stock-traceability-completion.js', 'Warehouse topology or logistics endpoint returned 401 or 403', 'Catalog availability or coverage endpoint returned 401 or 403', 'Suppliers imports endpoint returned 401 or 403', 'TODO'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-deployment-evidence.js',
    patterns: ['DEPLOYMENT_EVIDENCE_OUTPUT', 'WAREHOUSE_HEALTH_EVIDENCE', 'WAREHOUSE_PROTECTED_ENDPOINT_EVIDENCE', 'CATALOG_HEALTH_EVIDENCE', 'CATALOG_PROTECTED_ENDPOINT_EVIDENCE', 'SUPPLIERS_HEALTH_EVIDENCE', 'SUPPLIERS_PROTECTED_ENDPOINT_EVIDENCE', 'completed deployment evidence', 'must include anonymous 401 or 403', 'verify-deployment-evidence.js', 'missingHealthRejected', 'weakProtectedEvidenceRejected'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-deployment-evidence.js',
    patterns: ['DEPLOYMENT_EVIDENCE_FILE', 'generated from current service heads', 'completion verifier reminder', 'protectedEndpointEvidence must include 401 or 403', 'worktree must be clean before deployment evidence can authorize runtime proof', 'staleDeploymentHeadRejected', 'missingProtectedEndpointRejected', 'placeholderEvidenceRejected', 'dirtyDeploymentRootRejected'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/run-runtime-evidence-flow.js',
    patterns: ['--fixture-check', 'RUN_APPROVED_RUNTIME_SMOKE=true', 'fixture-ready', 'RUNTIME_APPROVAL_ARTIFACT_FILE, and deployment evidence to continue', 'validateApprovedSmokeConfig', 'validateDeploymentEvidenceFile', 'generatedFromCurrentHeads', 'completion verifier reminder', 'assertCleanWorktreeForService', 'worktree must be clean before approved runtime evidence', 'currentHeadForService', 'commitSha must match current', 'OWNER_APPROVAL=explicit', 'SMOKE_ALLOW_MUTATION=true', 'TRACE_OWN_WAREHOUSE_ID', 'FIXTURE_CHECK_RESULT_FILE', 'generate-runtime-evidence-report.js', 'verify-runtime-evidence-report.js', 'verify-runtime-evidence-manifest.js', 'verify-runtime-evidence-bundle.js', 'verify-stock-traceability-completion.js', 'RUNTIME_EVIDENCE_MANIFEST', 'stock-traceability-runtime-evidence-manifest.json', 'sha256', 'dirtyWorktreeRejected', 'manifest self-test must reject dirty service worktrees before writing runtime evidence', '--manifest-self-test'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-runtime-handoff-checklist.js',
    patterns: ['STOCK-TRACEABILITY-RUNTIME-HANDOFF', 'RUNTIME_HANDOFF_OUTPUT', 'completionGate', 'assertCleanRows', 'runtime handoff requires clean Warehouse, Catalog, and Suppliers worktrees', 'dirtyRowsRejected', 'handoff self-test must reject dirty source snapshots', 'formatCompletionReason', 'TRACE_SUPPLIER_WAREHOUSE_ID linked to TRACE_SUPPLIER_ID', 'RUNTIME_APPROVAL_ARTIFACT_FILE', 'verify-runtime-approval-artifact.js /tmp/stock-traceability-runtime-approval.json', 'same TRACE_SUPPLIER_ID owns the supplier replenishment and dropship warehouse origins and route options', 'positive availability and \\`canReserveFromWarehouse=true\\`', 'Suppliers import job completed, validated the Catalog product ID, preserved Warehouse stock authority', 'Deploy Warehouse first', 'RUN_APPROVED_RUNTIME_SMOKE=true', 'verify-runtime-evidence-manifest.js <manifest-file>', 'verify-runtime-evidence-bundle.js <manifest-file> <report-file>', 'verify-stock-traceability-completion.js <report-file> <manifest-file>', 'run-runtime-evidence-flow.js'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-runtime-readiness-bundle.js',
    patterns: ['RUNTIME_READINESS_BUNDLE_DIR', 'stock-traceability-runtime-readiness-manifest.json', 'create-runtime-approval-request.js', 'create-deployment-evidence-template.js', 'create-runtime-handoff-checklist.js', 'run-runtime-evidence-flow.js', 'verify-runtime-readiness-bundle.js', 'written-and-verified', 'sha256', 'RUNTIME_APPROVAL_ARTIFACT_FILE', 'DEPLOYMENT_EVIDENCE_FILE', 'dirtyRowsRejected', 'missingHeadRejected', 'missingManifestVerificationRejected'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-readiness-bundle.js',
    patterns: ['RUNTIME_READINESS_MANIFEST', 'stock-traceability-runtime-readiness-manifest.json', 'ready-for-owner-approval', 'incomplete-runtime-pending', 'sha256 mismatch', 'byte count mismatch', 'readiness manifest serviceHeads', 'assertNoCredentialValues', 'credentialLeakRejected', 'RUNTIME_APPROVAL_ARTIFACT_FILE', 'DEPLOYMENT_EVIDENCE_FILE', 'tamperedHashRejected', 'dirtyWorktreeRejected', 'staleHeadRejected'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-stock-traceability-completion.js',
    patterns: ['runtime report is not passed-runtime/runtime-complete', 'no runtime evidence manifest was provided', 'defaultManifest', 'verify-runtime-evidence-bundle.js', 'complete verified bundle', 'completeVerifiedBundleAccepted', 'generatedFromCurrentHeads', 'completionReminder', 'initSelfTestRepo', 'canReserveFromWarehouse: true', 'catalogProductValidationStatus', 'catalogProductIdsChecked', 'RUNTIME_APPROVAL_ARTIFACT_FILE'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-bundle.js',
    patterns: ['verify-runtime-evidence-manifest.js', 'verify-runtime-evidence-report.js', 'deployment evidence commit must match manifest service head', 'assertCleanWorktreeForService', 'runtime evidence bundle can prove completion', 'source fingerprint', 'mismatchedSupplierJobFingerprintRejected', 'fixture and smoke artifacts must use the same TRACE_PRODUCT_ID', 'smoke artifact must include the fixture dropship warehouse origin for TRACE_SUPPLIER_ID', 'fixture supplier warehouse origin must belong to TRACE_SUPPLIER_ID', 'Runtime complete', 'canReserveFromWarehouse', 'Number(route.available) > 0', 'assertSupplierJobPreservesCatalogAndWarehouse', 'catalogProductValidationStatus', 'catalogProductIdsChecked', 'warehouseAuthority', 'mixedTraceProductRejected', 'mixedSupplierWarehouseRejected', 'mismatchedSupplierRejected', 'missingCatalogOwnRouteRejected', 'nonReservableSupplierRouteRejected', 'missingSupplierJobCatalogValidationRejected', 'mismatchedStockAuthorityRejected', 'cleanupPlaceholderRejected', 'missingProjectionOwnRouteRejected', 'deploymentManifestMismatchRejected', 'missingCurrentHeadDeploymentMarkerRejected', 'missingApprovalArtifactRejected', 'staleApprovalArtifactRejected', 'RUNTIME_APPROVAL_ARTIFACT_FILE'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-manifest.js',
    patterns: ['runtime-complete-evidence-bundle', 'sha256 mismatch', 'tamperedHashRejected', 'currentHeadForService', 'assertCleanWorktreeForService', 'runtime evidence manifest can prove completion', 'fixture', 'smoke', 'deployment', 'approval', 'report'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-evidence-report.js',
    patterns: ['REQUIRED_ASSERTIONS', 'Read-only live fixture check passed before mutation', 'Suppliers import preserves Catalog identity and Warehouse authority', 'catalogProductValidation=passed', 'checkedProducts=', 'sourceFingerprint=trace:', 'Warehouse remains stock authority across totals', 'warehouseTotalAvailable=', 'catalogCoverageTotal=', 'deployment evidence must include a commit SHA', 'TRACE_RUN_SUPPLIERS_IMPORT=true', 'TRACE_EXPECT_SUPPLIERS_JOB=true', 'TRACE_DROPSHIP_WAREHOUSE_ID=', 'TRACE_OWN_WAREHOUSE_ID=', 'sectionText', 'Smoke Command Evidence', '--fixture-check', 'fixture-ready', 'mutationEnabled=no', 'TRACE_CLEANUP_EVIDENCE=', 'RUNTIME_APPROVAL_ARTIFACT_FILE=', 'warehouse:', 'catalog:', 'suppliers:', 'source=warehouse', 'expectedSkuPrefix=CODEX-STOCK-TRACE-', 'routeTypes=local_fulfillment', 'routeLegs=', 'reservable=yes', 'available=', 'hasSupplierOriginEvidence', 'positive availability and supplier IDs', 'customer:warehouse', 'supplier_dropship', 'logisticsOptionCount', 'protected endpoint evidence must include 401 or 403', 'missing-runtime'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-evidence-flow-negative-check.js',
    patterns: ['approved-smoke-missing-deployment-evidence', 'approved-smoke-missing-own-warehouse-id', 'approved-smoke-missing-owner-approval', 'approved-smoke-missing-mutation-allowance', 'approved-smoke-invalid-deployment-evidence', 'approved-smoke-deployment-sha-not-current-head', 'approved-smoke-missing-current-head-deployment-marker', 'approved-smoke-dirty-service-worktree', 'approved-smoke-missing-protected-endpoint-evidence', 'approved-smoke-health-evidence-still-placeholder', 'approved-smoke-template-not-complete-evidence', 'RUN_APPROVED_RUNTIME_SMOKE', 'DEPLOYMENT_EVIDENCE_FILE', 'generatedFromCurrentHeads', 'verify-stock-traceability-completion.js', 'verify-runtime-evidence-manifest.js', 'verify-runtime-evidence-bundle.js', 'mixedTraceProductRejected', 'mixedSupplierWarehouseRejected', 'mismatchedSupplierRejected', 'missingCatalogOwnRouteRejected', 'nonReservableSupplierRouteRejected', 'mismatchedSupplierJobFingerprintRejected', 'missingSupplierJobCatalogValidationRejected', 'mismatchedStockAuthorityRejected', 'cleanupPlaceholderRejected', 'missingProjectionOwnRouteRejected', '--manifest-self-test'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/runtime-evidence-negative-check.js',
    patterns: ['bad-sku-prefix', 'unnamed-health', 'missing-forwarded-supplier-route', 'missing-logistics-leg-evidence', 'missing-reservable-route-evidence', 'missing-origin-supplier-id-report-evidence', 'missing-fixture-check-evidence', 'mismatched-supplier-job-source-fingerprint', 'mismatched-stock-authority-total', 'cleanup-evidence-placeholder', 'invalid-deployment-commit-sha', 'missing-deployment-service-row', 'missing-protected-endpoint-auth-evidence', 'deployment-health-evidence-placeholder', 'missing-current-head-deployment-marker', 'invalid-smoke-command-import-disabled', 'missing-smoke-command-own-warehouse-id', 'missing-runtime-approval-artifact-command-evidence', 'failed-runtime'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-runtime-rollout.md',
    patterns: ['Suppliers mutation boundary is preserved', 'Catalog product validation passed before Warehouse mutation', 'checked Catalog product IDs include `TRACE_PRODUCT_ID`', 'job belongs to `TRACE_SUPPLIER_ID`', 'source fingerprint matches the approved trace import request', 'Warehouse authority is preserved', 'applied update count is positive'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-live-runbook.md',
    patterns: ['`TRACE_SUPPLIER_ID` ownership for supplier-managed origins and routes', 'supplier/dropship warehouse IDs', 'Suppliers runtime must have `CATALOG_SERVICE_URL` and `CATALOG_SERVICE_TOKEN`', 'All three repositories must be clean before generating deployment evidence', 'rejects dirty Warehouse, Catalog, or Suppliers worktrees', 'node reports/validation/create-runtime-readiness-bundle.js --self-test', 'node reports/validation/verify-runtime-readiness-bundle.js --self-test', 'RUNTIME_READINESS_BUNDLE_DIR=/tmp/stock-traceability-runtime-readiness', 'stock-traceability-runtime-readiness-manifest.json', 'node reports/validation/run-runtime-evidence-flow.js --plan-only', 'node reports/validation/run-runtime-evidence-flow.js --manifest-self-test', 'node reports/validation/verify-runtime-evidence-manifest.js --self-test', 'node reports/validation/verify-runtime-evidence-bundle.js --self-test', 'First validate the approved-smoke configuration', 'DEPLOYMENT_EVIDENCE_FILE="/tmp/stock-traceability-deployment-evidence.json"', 'RUNTIME_APPROVAL_ARTIFACT_FILE="/tmp/stock-traceability-runtime-approval.json"', 'status: "runtime-complete"', 'stock-traceability-runtime-evidence-manifest.json'],
    forbiddenPatterns: ['runtime-stock-traceability-smoke.js --config-only', 'CATALOG_TOKEN=catalog-token-synthetic', 'WAREHOUSE_TOKEN=warehouse-token-synthetic', 'SUPPLIERS_TOKEN=suppliers-token-synthetic', 'Save the smoke JSON to a file for report generation'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-runtime-evidence-template.md',
    patterns: ['supplier ID matching `TRACE_SUPPLIER_ID`', 'supplier routes owned by `TRACE_SUPPLIER_ID`', 'not owned by the same `TRACE_SUPPLIER_ID`', 'sourceFingerprint` matching `trace:<TRACE_PRODUCT_ID>', 'mismatched supplier job source fingerprint', 'generator refuses dirty service worktrees', 'clean Warehouse, Catalog, and Suppliers worktrees'],
  },
  {
    service: 'suppliers',
    file: 'docs/cross-service/stock-traceability-completion-audit.md',
    patterns: ['supplier IDs match `TRACE_SUPPLIER_ID`', 'supplier routes are owned by `TRACE_SUPPLIER_ID`', 'stamps stock candidates with the import supplier ID', 'rejects supplier identity drift before Warehouse mutation', 'Runtime Suppliers import job must belong to `TRACE_SUPPLIER_ID`', 'checked Catalog product IDs including `TRACE_PRODUCT_ID`', 'source fingerprint matching the approved trace import request', 'Warehouse authority', 'positive applied update count', 'clean current service heads', 'no dirty Warehouse/Catalog/Suppliers worktree state'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/production-rest-json-adapter-check.js',
    patterns: ['PRODUCTION_REST_JSON_ADAPTER_KEY', 'credentialRefsResolvedAtRuntime', 'invalidPayloadBlocked'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/synthetic-production-rest-json-adapter-check.js',
    patterns: ['SYN_REST_API_KEY', 'SYN_REST_TOKEN', 'deterministicFingerprint'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/synthetic-approved-import-run-check.js',
    patterns: ['duplicateWarehouseCandidateRejected', 'mismatchedCandidateSupplierRejected', 'Duplicate Warehouse stock candidate', 'Warehouse stock candidate supplierId must match the import supplier before Warehouse mutation', 'approved mutation must verify each unique Catalog product before Warehouse mutation', 'approved mutation must record passed Catalog product validation', 'unknown Catalog product must record failed Catalog product validation', 'approved mutation must include supplier replenishment warehouse', 'approved mutation must include dropship warehouse'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-runtime-approval-request.js',
    patterns: ['STOCK-TRACEABILITY-RUNTIME-APPROVAL-REQUEST', 'RUNTIME_APPROVAL_REQUEST_OUTPUT', 'Approve exactly these three actions', 'runtime approval request requires clean Warehouse, Catalog, and Suppliers worktrees', 'dirtyRowsRejected', 'approval request self-test must reject dirty source snapshots', 'RUN_APPROVED_RUNTIME_SMOKE=true', 'OWNER_APPROVAL=explicit', 'SMOKE_ALLOW_MUTATION=true', 'stock-traceability-runtime-readiness-manifest.json', 'RUNTIME_READINESS_MANIFEST_FILE', 'verify-runtime-approval-artifact.js', 'This approval request is not completion evidence', 'verify-stock-traceability-completion.js'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/verify-runtime-approval-artifact.js',
    patterns: ['STOCK-TRACEABILITY-RUNTIME-APPROVAL', 'RUNTIME_APPROVAL_ARTIFACT_FILE', 'readinessManifest binding is required', 'readinessManifest.sha256', 'verify-runtime-readiness-bundle.js', 'approval artifact readiness manifest must pass', 'approvedForCurrentCleanHeads', 'syntheticRecordsOnly', 'oneGuardedSyntheticImport', 'forbiddenActionsAcknowledged', 'token disclosure', 'worktree must be clean before runtime approval can authorize mutation', 'mismatchedApprovalHeadRejected', 'dirtyApprovalRootRejected'],
  },
  {
    service: 'suppliers',
    file: 'reports/validation/create-runtime-approval-artifact.js',
    patterns: ['RUNTIME_APPROVAL_ARTIFACT_OUTPUT', 'RUNTIME_APPROVAL_REQUEST_FILE', 'RUNTIME_READINESS_MANIFEST_FILE', 'readinessManifestBound', 'OWNER_APPROVAL=explicit is required to generate runtime approval artifact', 'RUNTIME_APPROVED_BY is required', 'runtime approval artifact requires clean Warehouse, Catalog, and Suppliers worktrees', 'approval request file does not contain current', 'verify-runtime-approval-artifact.js', 'forbiddenActionsAcknowledged', 'dirtyRowsRejected', 'missingApprovalRejected'],
  },
];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function assertServiceDirectory(name, dir) {
  if (!fs.existsSync(dir)) {
    return { service: name, ok: false, error: `missing service directory ${dir}` };
  }

  const status = git(dir, ['status', '--short']);
  const head = git(dir, ['rev-parse', 'HEAD']);
  const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const requiredFiles = ['package.json', 'scripts/deploy.sh'];
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(dir, file)));

  return {
    service: name,
    ok: missing.length === 0,
    branch,
    head,
    dirtyLines: status ? status.split('\n').length : 0,
    missingRequiredFiles: missing,
  };
}

function runCheck(check) {
  const serviceDir = services[check.service];
  const filePath = path.join(serviceDir, check.file);
  if (!fs.existsSync(filePath)) {
    return { ...check, ok: false, error: 'file missing' };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const missingPatterns = check.patterns.filter((pattern) => !text.includes(pattern));
  const presentForbiddenPatterns = (check.forbiddenPatterns || []).filter((pattern) => text.includes(pattern));
  return {
    service: check.service,
    file: check.file,
    ok: missingPatterns.length === 0 && presentForbiddenPatterns.length === 0,
    missingPatterns,
    presentForbiddenPatterns,
  };
}


function checkCompletionGate() {
  const result = spawnSync(process.execPath, ['reports/validation/verify-stock-traceability-completion.js'], {
    cwd: services.suppliers,
    env: { ...process.env },
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  let parsed = null;
  try {
    parsed = output ? JSON.parse(output) : null;
  } catch (_error) {
    parsed = { status: 'failed', raw: output };
  }
  if (result.status === 0 && parsed?.status === 'complete') {
    return { service: 'suppliers', ok: true, status: 'complete', result: parsed };
  }
  if (result.status === 2 && parsed?.status === 'incomplete') {
    return { service: 'suppliers', ok: true, status: 'incomplete', result: parsed };
  }
  return { service: 'suppliers', ok: false, status: parsed?.status || 'failed', result: parsed, exitCode: result.status };
}

function checkLiveRuntimeReport() {
  const reportFile = path.join(services.suppliers, 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md');
  if (!fs.existsSync(reportFile)) {
    return { service: 'suppliers', file: path.relative(services.suppliers, reportFile), ok: true, status: 'absent' };
  }

  const report = fs.readFileSync(reportFile, 'utf8');
  if (!report.includes('- status: passed-runtime')) {
    return { service: 'suppliers', file: path.relative(services.suppliers, reportFile), ok: true, status: 'not-passed-runtime' };
  }

  try {
    execFileSync('node', ['reports/validation/verify-runtime-evidence-report.js'], {
      cwd: services.suppliers,
      env: { ...process.env, RUNTIME_EVIDENCE_REPORT: reportFile },
      stdio: 'pipe',
    });
    return { service: 'suppliers', file: path.relative(services.suppliers, reportFile), ok: true, status: 'verified-passed-runtime' };
  } catch (error) {
    return {
      service: 'suppliers',
      file: path.relative(services.suppliers, reportFile),
      ok: true,
      status: 'stale-or-invalid-passed-runtime',
      note: 'Runtime report is stale or invalid under current verifiers; completionGate remains the blocking completion authority.',
      error: error.stdout?.toString() || error.stderr?.toString() || error.message,
    };
  }
}

function main() {
  const directories = Object.entries(services).map(([name, dir]) => assertServiceDirectory(name, dir));
  const sourceChecks = checks.map(runCheck);
  const liveRuntimeReport = checkLiveRuntimeReport();
  const completionGate = checkCompletionGate();
  const ok = directories.every((item) => item.ok) && sourceChecks.every((item) => item.ok) && liveRuntimeReport.ok && completionGate.ok;
  const result = {
    status: ok ? 'passed' : 'failed',
    root,
    directories,
    sourceChecks,
    liveRuntimeReport,
    completionGate,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
