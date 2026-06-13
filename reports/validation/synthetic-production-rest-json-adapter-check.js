const { of } = require('rxjs');
const {
  ProductionRestJsonSupplierAdapter,
} = require('../../dist/imports/adapters/production-rest-json-supplier-adapter.js');
const {
  validateSupplierAdapterResult,
} = require('../../dist/imports/adapters/supplier-import-adapter.js');
const { validateSupplierImportPayload } = require('../../dist/imports/import-validation.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createAdapter(responseData) {
  const calls = [];
  const httpService = {
    get: (url, options) => {
      calls.push({ url, options });
      return of({ data: responseData });
    },
  };
  return { adapter: new ProductionRestJsonSupplierAdapter(httpService), calls };
}

async function runValidScenario() {
  process.env.SYN_REST_API_KEY = 'synthetic-api-key';
  process.env.SYN_REST_TOKEN = 'synthetic-token';
  const { adapter, calls } = createAdapter({
    items: [
      {
        supplierSku: 'SUP-REST-001',
        stockQuantity: 8,
        sourceRecordId: 'source-rest-001',
        productId: 'product-synthetic',
        warehouseId: 'warehouse-supplier',
        observedAt: '2026-06-13T10:00:00.000Z',
      },
    ],
  });

  const context = {
    supplierId: 'supplier-rest-synthetic',
    idempotencyKey: 'manual:rest-json-synthetic',
    supplier: {
      id: 'supplier-rest-synthetic',
      code: 'rest-supplier-synthetic',
      apiType: 'rest',
      apiUrl: 'https://supplier.example.test/feed',
      apiCredentials: {
        apiKeyRef: 'SYN_REST_API_KEY',
        tokenRef: 'SYN_REST_TOKEN',
      },
    },
  };

  const first = await adapter.fetchNormalizedItems(context);
  const second = await adapter.fetchNormalizedItems(context);

  assert(calls.length === 2, 'adapter should make one HTTP GET per fetch');
  assert(calls[0].url === 'https://supplier.example.test/feed', 'adapter should call supplier apiUrl');
  assert(calls[0].options.headers.Accept === 'application/json', 'adapter should request JSON');
  assert(calls[0].options.headers['X-API-Key'] === 'synthetic-api-key', 'adapter should resolve API key from env ref');
  assert(calls[0].options.headers.Authorization === 'Bearer synthetic-token', 'adapter should resolve bearer token from env ref');
  assert(calls[0].options.maxRedirects === 0, 'adapter must not follow redirects');
  assert(first.adapterKey === 'rest', 'adapter key must be rest');
  assert(first.sourceFingerprint === second.sourceFingerprint, 'source fingerprint must be deterministic');
  assert(first.items[0].replayKey === second.items[0].replayKey, 'replay key must be deterministic');
  assert(first.items[0].supplierSku === 'SUP-REST-001', 'supplierSku must be preserved');
  assert(first.items[0].stockQuantity === 8, 'stockQuantity must be preserved');

  const adapterValidation = validateSupplierAdapterResult(first);
  assert(adapterValidation.valid, 'REST adapter output must pass adapter validation');
  const payloadValidation = validateSupplierImportPayload(first.items);
  assert(payloadValidation.valid, 'REST adapter output must pass normalized payload validation');

  return {
    adapterKey: first.adapterKey,
    totalItems: first.items.length,
    deterministicReplay: first.items[0].replayKey === second.items[0].replayKey,
    deterministicFingerprint: first.sourceFingerprint === second.sourceFingerprint,
    credentialRefsResolved: Boolean(calls[0].options.headers['X-API-Key'] && calls[0].options.headers.Authorization),
  };
}

async function runInvalidScenario() {
  const { adapter } = createAdapter({ items: [{ supplierSku: '', stockQuantity: -1 }] });
  try {
    await adapter.fetchNormalizedItems({
      supplierId: 'supplier-rest-synthetic',
      idempotencyKey: 'manual:rest-json-synthetic-invalid',
      supplier: {
        id: 'supplier-rest-synthetic',
        code: 'rest-supplier-synthetic',
        apiType: 'rest',
        apiUrl: 'https://supplier.example.test/feed',
        apiCredentials: null,
      },
    });
    throw new Error('invalid REST payload should fail');
  } catch (error) {
    assert(error.message.includes('supplierSku') || error.message.includes('stockQuantity'), 'invalid payload error should identify bad field');
    return { invalidPayloadBlocked: true };
  }
}

(async () => {
  const valid = await runValidScenario();
  const invalid = await runInvalidScenario();
  console.log(JSON.stringify({
    status: 'passed',
    ...valid,
    ...invalid,
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});
