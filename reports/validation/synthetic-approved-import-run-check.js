const { ImportsService } = require('../../dist/imports/imports.service.js');
const { validateWarehouseStockUpdateBoundary } = require('../../dist/imports/import-validation.js');
const { SyntheticTraceSupplierAdapter } = require('../../dist/imports/adapters/synthetic-trace-supplier-adapter.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function observableSuccess(data) {
  return { subscribe: (observer) => { observer.next(data); observer.complete(); } };
}

function observableError(error) {
  return { subscribe: (observer) => { observer.error(error); } };
}

function createHarness(options = {}) {
  const job = {
    id: 'job-synthetic',
    supplierId: 'supplier-synthetic',
    idempotencyKey: 'manual:traceability-synthetic',
    sourceFingerprint: 'source-fingerprint-synthetic',
    status: 'pending',
  };
  const updates = [];
  const posts = [];
  const catalogLookups = [];
  const catalogProducts = options.catalogProducts ?? {
    'product-synthetic': { id: 'product-synthetic', sku: 'CODEX-STOCK-TRACE-001' },
  };
  const importJobRepository = {
    findOne: async ({ where }) => {
      if (where?.id === job.id && where?.supplierId === job.supplierId) return { ...job, ...updates.at(-1) };
      if (where?.supplierId === job.supplierId && where?.idempotencyKey === job.idempotencyKey) return { ...job, ...updates.at(-1) };
      return null;
    },
    update: async (_id, data) => {
      updates.push(data);
    },
  };
  const supplierRepository = {
    findOne: async ({ where }) => where?.id === job.supplierId ? { id: job.supplierId, code: 'SYN', apiType: 'synthetic', isActive: true } : null,
  };
  const httpService = {
    get: (url, requestOptions) => {
      catalogLookups.push({ url, options: requestOptions });
      const productId = decodeURIComponent(String(url).split('/').at(-1));
      const product = catalogProducts[productId];
      if (!product) {
        return observableError({ response: { status: 404 } });
      }
      return observableSuccess({ data: { success: true, data: product } });
    },
    post: (url, body, requestOptions) => {
      posts.push({ url, body, options: requestOptions });
      return observableSuccess({ data: { success: true } });
    },
  };
  const adapter = {
    fetchNormalizedItems: async () => ({
      adapterKey: 'synthetic-adapter',
      sourceFingerprint: 'source-fingerprint-synthetic',
      items: [
        {
          sourceRecordId: 'source-record-synthetic-supplier',
          replayKey: 'replay-key-synthetic-supplier',
          supplierSku: 'SUP-SKU-SYNTHETIC',
          productId: 'product-synthetic',
          warehouseId: 'warehouse-supplier',
          supplierId: job.supplierId,
          stockQuantity: 7,
          observedAt: '2026-06-13T10:00:00.000Z',
        },
        {
          sourceRecordId: 'source-record-synthetic-dropship',
          replayKey: 'replay-key-synthetic-dropship',
          supplierSku: 'SUP-SKU-SYNTHETIC',
          productId: 'product-synthetic',
          warehouseId: 'warehouse-dropship',
          supplierId: job.supplierId,
          stockQuantity: 7,
          observedAt: '2026-06-13T10:00:00.000Z',
        },
      ],
    }),
  };
  const adapterRegistry = {
    get: () => undefined,
    requireForSupplier: () => adapter,
  };

  return { service: new ImportsService(importJobRepository, supplierRepository, httpService, adapterRegistry), job, updates, posts, catalogLookups };
}

async function runScenario(options, harnessOptions = {}) {
  process.env.WAREHOUSE_SERVICE_TOKEN = 'synthetic-token';
  process.env.WAREHOUSE_SERVICE_URL = 'http://warehouse.example.test';
  process.env.CATALOG_SERVICE_TOKEN = 'synthetic-catalog-token';
  process.env.CATALOG_SERVICE_URL = 'http://catalog.example.test';
  const harness = createHarness(harnessOptions);
  await harness.service.runImport(harness.job.id, harness.job.supplierId, options);
  return harness;
}


function assertDuplicateWarehouseCandidateRejected() {
  const result = validateWarehouseStockUpdateBoundary([
    {
      supplierSku: 'SUP-SKU-DUP-1',
      productId: 'product-synthetic',
      warehouseId: 'warehouse-supplier',
      supplierId: 'supplier-synthetic',
      stockQuantity: 4,
      observedAt: '2026-06-13T10:00:00.000Z',
    },
    {
      supplierSku: 'SUP-SKU-DUP-2',
      productId: 'product-synthetic',
      warehouseId: 'warehouse-supplier',
      supplierId: 'supplier-synthetic',
      stockQuantity: 6,
      observedAt: '2026-06-13T10:05:00.000Z',
    },
  ], {
    actor: 'suppliers-microservice',
    reason: 'supplier-import',
    idempotencyKey: 'manual:duplicate-candidate-check',
    approvedForMutation: true,
    mutationAttempted: true,
    expectedSupplierId: 'supplier-synthetic',
  });
  assert(result.valid === false, 'duplicate Warehouse stock candidates must be rejected');
  assert(result.errors.some((error) => error.error.includes('Duplicate Warehouse stock candidate')), 'duplicate candidate rejection must explain the duplicate origin');
}

function assertMissingCandidateSupplierRejected() {
  const result = validateWarehouseStockUpdateBoundary([
    {
      supplierSku: 'SUP-SKU-MISSING-SUPPLIER',
      productId: 'product-synthetic',
      warehouseId: 'warehouse-supplier',
      stockQuantity: 4,
      observedAt: '2026-06-13T10:00:00.000Z',
    },
  ], {
    actor: 'suppliers-microservice',
    reason: 'supplier-import',
    idempotencyKey: 'manual:supplier-missing-check',
    approvedForMutation: true,
    mutationAttempted: true,
    expectedSupplierId: 'supplier-synthetic',
  });
  assert(result.valid === false, 'missing supplierId candidate must be rejected before Warehouse mutation');
  assert(result.errors.some((error) => error.error.includes('Warehouse stock candidate supplierId is required and must match the import supplier before Warehouse mutation')), 'missing supplierId rejection must identify supplier ownership requirement');
}

function assertMismatchedCandidateSupplierRejected() {
  const result = validateWarehouseStockUpdateBoundary([
    {
      supplierSku: 'SUP-SKU-MISMATCH',
      productId: 'product-synthetic',
      warehouseId: 'warehouse-supplier',
      supplierId: 'different-supplier',
      stockQuantity: 4,
      observedAt: '2026-06-13T10:00:00.000Z',
    },
  ], {
    actor: 'suppliers-microservice',
    reason: 'supplier-import',
    idempotencyKey: 'manual:supplier-mismatch-check',
    approvedForMutation: true,
    mutationAttempted: true,
    expectedSupplierId: 'supplier-synthetic',
  });
  assert(result.valid === false, 'mismatched supplier candidate must be rejected before Warehouse mutation');
  assert(result.errors.some((error) => error.error.includes('Warehouse stock candidate supplierId must match the import supplier before Warehouse mutation')), 'supplier mismatch rejection must identify supplierId ownership drift');
}

async function assertSyntheticTraceAdapter() {
  const adapter = new SyntheticTraceSupplierAdapter();
  const result = await adapter.fetchNormalizedItems({
    supplierId: 'supplier-synthetic',
    idempotencyKey: 'manual:traceability-synthetic',
    sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-SYNTHETIC',
  });
  assert(result.adapterKey === 'synthetic-trace', 'synthetic trace adapter key must be stable');
  assert(result.items.length === 2, 'synthetic trace adapter must emit supplier and dropship items');
  assert(result.items.every((item) => item.productId === 'product-synthetic'), 'synthetic trace adapter must preserve product ID');
  assert(result.items.every((item) => item.supplierId === 'supplier-synthetic'), 'synthetic trace adapter must stamp import supplier ID');
  assert(result.items.some((item) => item.warehouseId === 'warehouse-supplier'), 'synthetic trace adapter must preserve supplier warehouse ID');
  assert(result.items.some((item) => item.warehouseId === 'warehouse-dropship'), 'synthetic trace adapter must preserve dropship warehouse ID');
  assert(result.items.every((item) => item.stockQuantity === 7), 'synthetic trace adapter must preserve stock quantity');

  const legacy = await adapter.fetchNormalizedItems({
    supplierId: 'supplier-synthetic',
    idempotencyKey: 'manual:traceability-legacy',
    sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:7:SUP-SKU-SYNTHETIC',
  });
  assert(legacy.items.length === 1, 'synthetic trace adapter must keep legacy one-warehouse fingerprints compatible');
}

(async () => {
  assertDuplicateWarehouseCandidateRejected();
  assertMissingCandidateSupplierRejected();
  assertMismatchedCandidateSupplierRejected();
  await assertSyntheticTraceAdapter();
  const validateOnly = await runScenario({});
  const validateOnlyCompletion = validateOnly.updates.at(-1);
  assert(validateOnly.posts.length === 0, 'validate-only import must not call Warehouse');
  assert(validateOnly.catalogLookups.length === 0, 'validate-only import must not call Catalog product lookup');
  assert(validateOnlyCompletion.warehouseStockUpdateAttempted === false, 'validate-only must record no mutation attempt');
  assert(validateOnlyCompletion.warehouseStockUpdateApproved === false, 'validate-only must record no approval');
  assert(Number(validateOnlyCompletion.updatedProducts || 0) === 0, 'validate-only must not report applied updates');

  const unapproved = await runScenario({ warehouseStockUpdateMode: 'apply_with_owner_approval' });
  const unapprovedCompletion = unapproved.updates.at(-1);
  assert(unapproved.posts.length === 0, 'unapproved mutation attempt must not call Warehouse');
  assert(unapproved.catalogLookups.length === 0, 'unapproved mutation attempt must not call Catalog product lookup');
  assert(unapprovedCompletion.status === 'failed', 'unapproved mutation attempt must fail validation');
  assert(unapprovedCompletion.warehouseStockUpdateAttempted === true, 'unapproved attempt must be recorded as attempted');
  assert(unapprovedCompletion.warehouseStockUpdateApproved === false, 'unapproved attempt must not be approved');

  const approved = await runScenario({ warehouseStockUpdateMode: 'apply_with_owner_approval', ownerApproval: 'explicit' });
  const approvedCompletion = approved.updates.at(-1);
  assert(approved.catalogLookups.length === 1, 'approved mutation must verify each unique Catalog product before Warehouse mutation');
  assert(approved.catalogLookups[0].url === 'http://catalog.example.test/api/products/product-synthetic', 'approved mutation must call Catalog product identity endpoint');
  assert(approved.posts.length === 2, 'approved mutation must call Warehouse once per supplier stock candidate');
  assert(approved.posts.every((post) => post.url === 'http://warehouse.example.test/api/supplier-reconciliations'), 'approved mutation must call Warehouse supplier reconciliation endpoint');
  assert(approved.posts.some((post) => post.body.warehouseId === 'warehouse-supplier'), 'approved mutation must include supplier replenishment warehouse');
  assert(approved.posts.some((post) => post.body.warehouseId === 'warehouse-dropship'), 'approved mutation must include dropship warehouse');
  assert(approved.posts.every((post) => post.body.externalReference.startsWith('supplier-import:')), 'approved mutation must use idempotency-derived externalReference');
  assert(approvedCompletion.status === 'completed', 'approved mutation must complete');
  assert(approvedCompletion.warehouseStockUpdateAttempted === true, 'approved mutation must record attempt');
  assert(approvedCompletion.warehouseStockUpdateApproved === true, 'approved mutation must record approval');
  assert(approvedCompletion.updatedProducts === 2, 'approved mutation must report both applied updates');
  assert(approvedCompletion.catalogProductValidationStatus === 'passed', 'approved mutation must record passed Catalog product validation');
  assert(JSON.stringify(approvedCompletion.catalogProductIdsChecked) === JSON.stringify(['product-synthetic']), 'approved mutation must record checked Catalog product IDs');

  const unknownCatalogProduct = await runScenario(
    { warehouseStockUpdateMode: 'apply_with_owner_approval', ownerApproval: 'explicit' },
    { catalogProducts: {} },
  );
  const unknownCatalogProductCompletion = unknownCatalogProduct.updates.at(-1);
  assert(unknownCatalogProduct.catalogLookups.length === 1, 'unknown Catalog product path must check Catalog once');
  assert(unknownCatalogProduct.posts.length === 0, 'unknown Catalog product must block Warehouse mutation');
  assert(unknownCatalogProductCompletion.status === 'failed', 'unknown Catalog product must fail the import job');
  assert(unknownCatalogProductCompletion.catalogProductValidationStatus === 'failed', 'unknown Catalog product must record failed Catalog product validation');
  assert(JSON.stringify(unknownCatalogProductCompletion.catalogProductValidationErrors).includes('unknown Catalog product ID'), 'unknown Catalog product validation error must identify the missing Catalog identity');
  assert(JSON.stringify(unknownCatalogProductCompletion.errors).includes('unknown Catalog product ID'), 'unknown Catalog product failure must explain the missing Catalog identity');

  console.log(JSON.stringify({
    status: 'passed',
    duplicateWarehouseCandidateRejected: true,
    missingCandidateSupplierRejected: true,
    mismatchedCandidateSupplierRejected: true,
    syntheticAdapter: 'passed',
    validateOnly: {
      catalogLookups: validateOnly.catalogLookups.length,
      warehouseCalls: validateOnly.posts.length,
      attempted: validateOnlyCompletion.warehouseStockUpdateAttempted,
      approved: validateOnlyCompletion.warehouseStockUpdateApproved,
    },
    unapprovedAttempt: {
      catalogLookups: unapproved.catalogLookups.length,
      warehouseCalls: unapproved.posts.length,
      status: unapprovedCompletion.status,
      attempted: unapprovedCompletion.warehouseStockUpdateAttempted,
      approved: unapprovedCompletion.warehouseStockUpdateApproved,
    },
    approvedAttempt: {
      catalogLookups: approved.catalogLookups.length,
      warehouseCalls: approved.posts.length,
      status: approvedCompletion.status,
      attempted: approvedCompletion.warehouseStockUpdateAttempted,
      approved: approvedCompletion.warehouseStockUpdateApproved,
      updatedProducts: approvedCompletion.updatedProducts,
      catalogProductValidationStatus: approvedCompletion.catalogProductValidationStatus,
      catalogProductIdsChecked: approvedCompletion.catalogProductIdsChecked,
      externalReferencePrefix: approved.posts[0].body.externalReference.slice(0, 16),
    },
    unknownCatalogProduct: {
      catalogLookups: unknownCatalogProduct.catalogLookups.length,
      warehouseCalls: unknownCatalogProduct.posts.length,
      status: unknownCatalogProductCompletion.status,
      catalogProductValidationStatus: unknownCatalogProductCompletion.catalogProductValidationStatus,
    },
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});
