const { ImportsService } = require('../../dist/imports/imports.service.js');
const { validateWarehouseStockUpdateBoundary } = require('../../dist/imports/import-validation.js');
const { SyntheticTraceSupplierAdapter } = require('../../dist/imports/adapters/synthetic-trace-supplier-adapter.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createHarness() {
  const job = {
    id: 'job-synthetic',
    supplierId: 'supplier-synthetic',
    idempotencyKey: 'manual:traceability-synthetic',
    sourceFingerprint: 'source-fingerprint-synthetic',
    status: 'pending',
  };
  const updates = [];
  const posts = [];
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
    post: (url, body, options) => {
      posts.push({ url, body, options });
      return { subscribe: (observer) => { observer.next({ data: { success: true } }); observer.complete(); } };
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
          stockQuantity: 7,
          observedAt: '2026-06-13T10:00:00.000Z',
        },
        {
          sourceRecordId: 'source-record-synthetic-dropship',
          replayKey: 'replay-key-synthetic-dropship',
          supplierSku: 'SUP-SKU-SYNTHETIC',
          productId: 'product-synthetic',
          warehouseId: 'warehouse-dropship',
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

  return { service: new ImportsService(importJobRepository, supplierRepository, httpService, adapterRegistry), job, updates, posts };
}

async function runScenario(options) {
  process.env.WAREHOUSE_SERVICE_TOKEN = 'synthetic-token';
  process.env.WAREHOUSE_SERVICE_URL = 'http://warehouse.example.test';
  const harness = createHarness();
  await harness.service.runImport(harness.job.id, harness.job.supplierId, options);
  return harness;
}


function assertDuplicateWarehouseCandidateRejected() {
  const result = validateWarehouseStockUpdateBoundary([
    {
      supplierSku: 'SUP-SKU-DUP-1',
      productId: 'product-synthetic',
      warehouseId: 'warehouse-supplier',
      stockQuantity: 4,
      observedAt: '2026-06-13T10:00:00.000Z',
    },
    {
      supplierSku: 'SUP-SKU-DUP-2',
      productId: 'product-synthetic',
      warehouseId: 'warehouse-supplier',
      stockQuantity: 6,
      observedAt: '2026-06-13T10:05:00.000Z',
    },
  ], {
    actor: 'suppliers-microservice',
    reason: 'supplier-import',
    idempotencyKey: 'manual:duplicate-candidate-check',
    approvedForMutation: true,
    mutationAttempted: true,
  });
  assert(result.valid === false, 'duplicate Warehouse stock candidates must be rejected');
  assert(result.errors.some((error) => error.error.includes('Duplicate Warehouse stock candidate')), 'duplicate candidate rejection must explain the duplicate origin');
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
  await assertSyntheticTraceAdapter();
  const validateOnly = await runScenario({});
  const validateOnlyCompletion = validateOnly.updates.at(-1);
  assert(validateOnly.posts.length === 0, 'validate-only import must not call Warehouse');
  assert(validateOnlyCompletion.warehouseStockUpdateAttempted === false, 'validate-only must record no mutation attempt');
  assert(validateOnlyCompletion.warehouseStockUpdateApproved === false, 'validate-only must record no approval');
  assert(Number(validateOnlyCompletion.updatedProducts || 0) === 0, 'validate-only must not report applied updates');

  const unapproved = await runScenario({ warehouseStockUpdateMode: 'apply_with_owner_approval' });
  const unapprovedCompletion = unapproved.updates.at(-1);
  assert(unapproved.posts.length === 0, 'unapproved mutation attempt must not call Warehouse');
  assert(unapprovedCompletion.status === 'failed', 'unapproved mutation attempt must fail validation');
  assert(unapprovedCompletion.warehouseStockUpdateAttempted === true, 'unapproved attempt must be recorded as attempted');
  assert(unapprovedCompletion.warehouseStockUpdateApproved === false, 'unapproved attempt must not be approved');

  const approved = await runScenario({ warehouseStockUpdateMode: 'apply_with_owner_approval', ownerApproval: 'explicit' });
  const approvedCompletion = approved.updates.at(-1);
  assert(approved.posts.length === 2, 'approved mutation must call Warehouse once per supplier stock candidate');
  assert(approved.posts.every((post) => post.url === 'http://warehouse.example.test/api/supplier-reconciliations'), 'approved mutation must call Warehouse supplier reconciliation endpoint');
  assert(approved.posts.some((post) => post.body.warehouseId === 'warehouse-supplier'), 'approved mutation must include supplier replenishment warehouse');
  assert(approved.posts.some((post) => post.body.warehouseId === 'warehouse-dropship'), 'approved mutation must include dropship warehouse');
  assert(approved.posts.every((post) => post.body.externalReference.startsWith('supplier-import:')), 'approved mutation must use idempotency-derived externalReference');
  assert(approvedCompletion.status === 'completed', 'approved mutation must complete');
  assert(approvedCompletion.warehouseStockUpdateAttempted === true, 'approved mutation must record attempt');
  assert(approvedCompletion.warehouseStockUpdateApproved === true, 'approved mutation must record approval');
  assert(approvedCompletion.updatedProducts === 2, 'approved mutation must report both applied updates');

  console.log(JSON.stringify({
    status: 'passed',
    duplicateWarehouseCandidateRejected: true,
    syntheticAdapter: 'passed',
    validateOnly: {
      warehouseCalls: validateOnly.posts.length,
      attempted: validateOnlyCompletion.warehouseStockUpdateAttempted,
      approved: validateOnlyCompletion.warehouseStockUpdateApproved,
    },
    unapprovedAttempt: {
      warehouseCalls: unapproved.posts.length,
      status: unapprovedCompletion.status,
      attempted: unapprovedCompletion.warehouseStockUpdateAttempted,
      approved: unapprovedCompletion.warehouseStockUpdateApproved,
    },
    approvedAttempt: {
      warehouseCalls: approved.posts.length,
      status: approvedCompletion.status,
      attempted: approvedCompletion.warehouseStockUpdateAttempted,
      approved: approvedCompletion.warehouseStockUpdateApproved,
      updatedProducts: approvedCompletion.updatedProducts,
      externalReferencePrefix: approved.posts[0].body.externalReference.slice(0, 16),
    },
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});
