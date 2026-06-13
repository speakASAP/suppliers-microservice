const crypto = require("crypto");
const { of } = require("rxjs");
const {
  ProductionRestJsonSupplierAdapter,
  PRODUCTION_REST_JSON_ADAPTER_KEY,
} = require("../../dist/imports/adapters/production-rest-json-supplier-adapter.js");
const {
  validateSupplierAdapterResult,
} = require("../../dist/imports/adapters/supplier-import-adapter.js");
const { validateSupplierImportPayload } = require("../../dist/imports/import-validation.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectedReplayKey(idempotencyKey, sourceRecordId) {
  return crypto.createHash("sha256").update([idempotencyKey, sourceRecordId].join(":")).digest("hex").slice(0, 32);
}

let capturedRequest;
process.env.SUPPLIER_TEST_REST_KEY = "runtime-test-key";

const httpService = {
  get(url, options) {
    capturedRequest = { url, options };
    return of({
      data: {
        items: [
          {
            supplierSku: "SYN-SKU-REST-001",
            stockQuantity: 7,
            sourceRecordId: "rest-record-001",
            productId: "product-synthetic-rest",
            warehouseId: "warehouse-synthetic-rest",
            observedAt: "2026-06-13T10:00:00.000Z",
          },
          {
            supplierSku: "SYN-SKU-REST-002",
            stockQuantity: 0,
          },
        ],
      },
    });
  },
};

(async () => {
  const adapter = new ProductionRestJsonSupplierAdapter(httpService);
  const context = {
    supplierId: "supplier-synthetic-rest",
    idempotencyKey: "manual:production-rest-json-synthetic",
    supplier: {
      id: "supplier-synthetic-rest",
      code: "supplier-synthetic-rest-code",
      apiType: "rest",
      apiUrl: "https://supplier.invalid/items",
      apiCredentials: { apiKeyRef: "SUPPLIER_TEST_REST_KEY" },
    },
  };

  assert(adapter.metadata.adapterKey === PRODUCTION_REST_JSON_ADAPTER_KEY, "adapter key must be rest");
  assert(adapter.metadata.contractVersion === "PRODUCTION-REST-JSON-V1", "contract version must match production contract");

  const first = await adapter.fetchNormalizedItems(context);
  const second = await adapter.fetchNormalizedItems(context);

  const adapterValidation = validateSupplierAdapterResult(first);
  assert(adapterValidation.valid, "REST adapter output must pass adapter validation");
  assert(adapterValidation.totalItems === 2, "REST adapter should normalize two items");
  assert(validateSupplierImportPayload(first.items).valid, "REST adapter output must pass supplier payload validation");
  assert(first.items[0].replayKey === expectedReplayKey(context.idempotencyKey, "rest-record-001"), "explicit sourceRecordId replay key must be deterministic");
  assert(first.items[1].sourceRecordId === "SYN-SKU-REST-002", "sourceRecordId must default to supplierSku");
  assert(first.items[1].replayKey === second.items[1].replayKey, "defaulted replay key must be deterministic");
  assert(first.sourceFingerprint === second.sourceFingerprint, "source fingerprint must be deterministic");
  assert(capturedRequest.url === context.supplier.apiUrl, "adapter must call supplier apiUrl");
  assert(capturedRequest.options.headers.Accept === "application/json", "adapter must request JSON");
  assert(capturedRequest.options.headers["X-API-Key"] === process.env.SUPPLIER_TEST_REST_KEY, "adapter must resolve credential refs at runtime");
  assert(capturedRequest.options.maxRedirects === 0, "adapter must disable redirects");

  const invalidAdapter = new ProductionRestJsonSupplierAdapter({ get: () => of({ data: { invalid: true } }) });
  let invalidBlocked = false;
  try {
    await invalidAdapter.fetchNormalizedItems(context);
  } catch (_error) {
    invalidBlocked = true;
  }
  assert(invalidBlocked, "invalid REST payload must be blocked");

  console.log(JSON.stringify({
    status: "passed",
    adapterKey: first.adapterKey,
    contractVersion: adapter.metadata.contractVersion,
    totalItems: first.items.length,
    deterministicReplay: first.items[0].replayKey === second.items[0].replayKey,
    invalidPayloadBlocked: invalidBlocked,
    credentialRefsResolvedAtRuntime: true,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
