const crypto = require("crypto");
const {
  SupplierAdapterRegistry,
  SupplierAdapterNotFoundError,
} = require("../../dist/imports/adapters/supplier-adapter-registry.js");
const {
  validateSupplierAdapterResult,
} = require("../../dist/imports/adapters/supplier-import-adapter.js");
const { validateSupplierImportPayload } = require("../../dist/imports/import-validation.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replayKey(context, sourceRecordId) {
  return crypto
    .createHash("sha256")
    .update([context.idempotencyKey, sourceRecordId].join(":"))
    .digest("hex")
    .slice(0, 32);
}

const registry = new SupplierAdapterRegistry();

try {
  registry.requireForSupplier("supplier-synthetic-missing", "missing-adapter");
  throw new Error("missing adapter should throw");
} catch (error) {
  assert(error instanceof SupplierAdapterNotFoundError, "missing adapter must use sanitized not-found error");
  assert(!error.message.includes("supplier-synthetic-missing"), "missing adapter error must not expose supplier identifiers");
}

const context = {
  supplierId: "supplier-synthetic",
  idempotencyKey: "manual:adapter-foundation-synthetic",
  sourceFingerprint: "synthetic-source-v1",
};

const malformed = validateSupplierAdapterResult({
  adapterKey: "synthetic-adapter",
  sourceFingerprint: context.sourceFingerprint,
  items: [
    {
      supplierSku: "SUP-SYN-001",
      productId: "product-synthetic",
      warehouseId: "warehouse-synthetic",
      stockQuantity: 3,
      sourceRecordId: "",
      replayKey: "",
    },
  ],
});
assert(!malformed.valid, "malformed adapter output must fail");
assert(malformed.errors.some((item) => item.field === "sourceRecordId"), "sourceRecordId must be required");
assert(malformed.errors.some((item) => item.field === "replayKey"), "replayKey must be required");

const syntheticAdapter = {
  metadata: {
    adapterKey: "synthetic-adapter",
    sourceType: "synthetic",
    contractVersion: "TASK-006",
    supportsSyntheticValidation: true,
  },
  async fetchNormalizedItems(runContext) {
    const sourceRecordId = "synthetic-record-001";
    return {
      adapterKey: "synthetic-adapter",
      sourceFingerprint: runContext.sourceFingerprint || "synthetic-source-v1",
      items: [
        {
          sourceRecordId,
          replayKey: replayKey(runContext, sourceRecordId),
          supplierSku: "SUP-SYN-001",
          productId: "product-synthetic",
          warehouseId: "warehouse-synthetic",
          stockQuantity: 3,
          observedAt: "2026-06-13T10:00:00.000Z",
        },
      ],
    };
  },
};

registry.register(syntheticAdapter);
assert(registry.requireForSupplier(context.supplierId, "synthetic-adapter") === syntheticAdapter, "registered adapter should resolve");

(async () => {
  const first = await syntheticAdapter.fetchNormalizedItems(context);
  const second = await syntheticAdapter.fetchNormalizedItems(context);

  const adapterValidation = validateSupplierAdapterResult(first);
  assert(adapterValidation.valid, "valid synthetic adapter result should pass");
  assert(adapterValidation.totalItems === 1, "expected one synthetic item");
  assert(first.items[0].replayKey === second.items[0].replayKey, "replay key must be deterministic");
  assert(first.sourceFingerprint === second.sourceFingerprint, "source fingerprint must be deterministic");

  const payloadValidation = validateSupplierImportPayload(first.items);
  assert(payloadValidation.valid, "adapter output must pass normalized payload validation");

  console.log(JSON.stringify({
    status: "passed",
    adapterKey: first.adapterKey,
    sourceFingerprint: first.sourceFingerprint,
    totalItems: first.items.length,
    deterministicReplay: first.items[0].replayKey === second.items[0].replayKey,
    missingAdapterSanitized: true,
    malformedPayloadBlocked: true,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
