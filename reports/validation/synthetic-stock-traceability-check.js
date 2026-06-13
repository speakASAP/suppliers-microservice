const crypto = require("crypto");
const { validateWarehouseStockUpdateBoundary } = require("../../dist/imports/import-validation.js");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deriveCoverageItem(item) {
  const localAvailable = item.warehouses
    .filter((warehouse) => warehouse.warehouseType === "own")
    .reduce((total, warehouse) => total + warehouse.available, 0);
  const supplierAvailable = item.warehouses
    .filter((warehouse) => warehouse.warehouseType === "supplier")
    .reduce((total, warehouse) => total + warehouse.available, 0);
  const dropshipAvailable = item.warehouses
    .filter((warehouse) => warehouse.warehouseType === "dropship")
    .reduce((total, warehouse) => total + warehouse.available, 0);
  const positiveOrigins = [localAvailable > 0, supplierAvailable > 0, dropshipAvailable > 0].filter(Boolean).length;
  const stockOrigin = item.totalAvailable <= 0
    ? "out_of_stock"
    : positiveOrigins > 1
      ? "mixed_stock"
      : localAvailable > 0
        ? "local_stock"
        : supplierAvailable > 0
          ? "supplier_stock"
          : dropshipAvailable > 0
            ? "dropship_stock"
            : "out_of_stock";
  const hasReservableRoute = Boolean(item.logistics?.options?.some((option) => option.available > 0 && option.canReserveFromWarehouse));
  const blockingReasons = [];

  if (item.totalAvailable <= 0 || item.warehouses.length === 0) {
    blockingReasons.push("warehouse_stock_missing");
  }
  if (item.totalAvailable > 0 && !hasReservableRoute) {
    blockingReasons.push("warehouse_logistics_route_missing");
  }

  return {
    productId: item.productId,
    sku: item.sku,
    source: "warehouse",
    coverageStatus: blockingReasons.includes("warehouse_stock_missing")
      ? "missing_stock"
      : blockingReasons.includes("warehouse_logistics_route_missing")
        ? "missing_route"
        : "covered",
    stockOrigin,
    sellableWithWarehouse: blockingReasons.length === 0,
    totalAvailable: item.totalAvailable,
    localAvailable,
    supplierAvailable,
    dropshipAvailable,
    warehouseCount: item.warehouses.length,
    routeCount: item.logistics?.options?.length ?? 0,
    preferredRoute: item.logistics?.preferredRoute ?? null,
    blockingReasons,
    warehouses: item.warehouses,
    logistics: item.logistics,
  };
}

const supplierId = "supplier-synthetic";
const catalogProduct = {
  id: "product-synthetic",
  sku: "SKU-SYNTHETIC",
  title: "Synthetic traceable product",
};
const supplierCandidate = {
  supplierSku: "SUP-SKU-SYNTHETIC",
  productId: catalogProduct.id,
  warehouseId: "warehouse-supplier",
  stockQuantity: 7,
  observedAt: "2026-06-13T10:00:00.000Z",
};
const idempotencyKey = "manual:traceability-synthetic";
const policy = {
  actor: "suppliers-microservice",
  reason: "supplier-import",
  idempotencyKey,
  approvedForMutation: true,
  mutationAttempted: true,
};

const boundary = validateWarehouseStockUpdateBoundary([supplierCandidate], policy);
assert(boundary.valid, "approved supplier stock candidate should validate");
assert(boundary.totalStockUpdates === 1, "expected one stock candidate");

const externalReference = "supplier-import:" + crypto
  .createHash("sha256")
  .update([idempotencyKey, supplierCandidate.supplierSku, supplierCandidate.productId, supplierCandidate.warehouseId].join(":"))
  .digest("hex")
  .slice(0, 48);

const warehouseReconciliationRequest = {
  supplierId,
  warehouseId: supplierCandidate.warehouseId,
  productId: supplierCandidate.productId,
  quantity: supplierCandidate.stockQuantity,
  externalReference,
  actor: policy.actor,
  observedAt: supplierCandidate.observedAt,
};

for (const key of ["supplierId", "warehouseId", "productId", "quantity", "externalReference", "actor", "observedAt"]) {
  assert(Object.prototype.hasOwnProperty.call(warehouseReconciliationRequest, key), `missing Warehouse reconciliation key ${key}`);
}
assert(warehouseReconciliationRequest.externalReference.startsWith("supplier-import:"), "externalReference must be idempotency-derived");

const warehouseAvailability = {
  productId: catalogProduct.id,
  totalQuantity: 12,
  totalReserved: 1,
  totalAvailable: 11,
  warehouses: [
    {
      warehouseId: "warehouse-own",
      warehouseCode: "OWN-PRG",
      warehouseName: "Prague Main Warehouse",
      warehouseType: "own",
      supplierId: null,
      quantity: 5,
      reserved: 1,
      available: 4,
    },
    {
      warehouseId: "warehouse-supplier",
      warehouseCode: "SUP-SYN",
      warehouseName: "Synthetic Supplier Warehouse",
      warehouseType: "dropship",
      supplierId,
      quantity: 7,
      reserved: 0,
      available: 7,
    },
  ],
};

assert(warehouseAvailability.warehouses.some((row) => row.warehouseType === "own"), "expected own stock row");
assert(warehouseAvailability.warehouses.some((row) => row.warehouseType === "dropship" && row.supplierId === supplierId), "expected supplier/dropship stock row");

const warehouseLogistics = {
  generatedAt: "2026-06-13T10:01:00.000Z",
  productId: catalogProduct.id,
  preferredRoute: "local_fulfillment",
  totals: {
    totalQuantity: 12,
    totalReserved: 1,
    totalAvailable: 11,
    routeCount: 2,
    ownAvailable: 4,
    supplierAvailable: 0,
    dropshipAvailable: 7,
  },
  options: [
    {
      productId: catalogProduct.id,
      warehouseId: "warehouse-own",
      warehouseCode: "OWN-PRG",
      warehouseName: "Prague Main Warehouse",
      warehouseType: "own",
      originType: "own",
      supplierId: null,
      priority: 20,
      quantity: 5,
      reserved: 1,
      available: 4,
      routeType: "local_fulfillment",
      routeLabel: "Ship from Alfares warehouse to customer",
      canReserveFromWarehouse: true,
      requiresSupplierCoordination: false,
      legs: [{ sequence: 1, from: "OWN-PRG", to: "customer", responsibility: "warehouse" }],
    },
    {
      productId: catalogProduct.id,
      warehouseId: "warehouse-supplier",
      warehouseCode: "SUP-SYN",
      warehouseName: "Synthetic Supplier Warehouse",
      warehouseType: "dropship",
      originType: "dropship",
      supplierId,
      priority: 5,
      quantity: 7,
      reserved: 0,
      available: 7,
      routeType: "supplier_dropship",
      routeLabel: "Supplier or dropship warehouse ships directly to customer",
      canReserveFromWarehouse: true,
      requiresSupplierCoordination: true,
      legs: [{ sequence: 1, from: "SUP-SYN", to: "customer", responsibility: "supplier" }],
    },
  ],
};

assert(warehouseLogistics.preferredRoute === "local_fulfillment", "expected local route to be preferred");
assert(warehouseLogistics.options.some((option) => option.routeType === "supplier_dropship" && option.supplierId === supplierId), "expected supplier dropship route");

const catalogAvailabilityItem = {
  ...warehouseAvailability,
  sku: catalogProduct.sku,
  source: "warehouse",
  logistics: warehouseLogistics,
};

const catalogCoverageItem = deriveCoverageItem(catalogAvailabilityItem);

const flipflopProjection = {
  productId: catalogProduct.id,
  sku: catalogProduct.sku,
  title: catalogProduct.title,
  availability: {
    source: "warehouse",
    totalQuantity: catalogAvailabilityItem.totalQuantity,
    totalReserved: catalogAvailabilityItem.totalReserved,
    totalAvailable: catalogAvailabilityItem.totalAvailable,
    warehouses: catalogAvailabilityItem.warehouses,
    logistics: catalogAvailabilityItem.logistics,
  },
  stockQuantity: catalogAvailabilityItem.totalAvailable,
};

assert(flipflopProjection.availability.source === "warehouse", "Catalog projection must identify Warehouse as availability source");
assert(flipflopProjection.stockQuantity === 11, "stockQuantity must remain totalAvailable compatibility alias");
assert(flipflopProjection.availability.warehouses.length === 2, "projection must preserve both origin rows");
assert(flipflopProjection.availability.warehouses[1].supplierId === supplierId, "supplier origin row must preserve supplierId");
assert(flipflopProjection.availability.logistics.preferredRoute === "local_fulfillment", "projection must preserve Warehouse preferred logistics route");
assert(flipflopProjection.availability.logistics.options.some((option) => option.routeType === "supplier_dropship"), "projection must preserve supplier dropship logistics route");
assert(catalogCoverageItem.coverageStatus === "covered", "Catalog coverage must mark Warehouse-backed stock as covered");
assert(catalogCoverageItem.stockOrigin === "mixed_stock", "Catalog coverage must identify mixed local and supplier/dropship origins");
assert(catalogCoverageItem.sellableWithWarehouse === true, "Catalog coverage must allow sellable Warehouse-backed stock with a reservable route");
assert(catalogCoverageItem.localAvailable === 4 && catalogCoverageItem.dropshipAvailable === 7, "Catalog coverage must preserve origin availability totals");

console.log(JSON.stringify({
  status: "passed",
  productId: catalogProduct.id,
  sku: catalogProduct.sku,
  externalReference,
  coverageStatus: catalogCoverageItem.coverageStatus,
  stockOrigin: catalogCoverageItem.stockOrigin,
  preferredRoute: flipflopProjection.availability.logistics.preferredRoute,
  routes: flipflopProjection.availability.logistics.options.map((option) => option.routeType),
  origins: flipflopProjection.availability.warehouses.map((row) => ({
    warehouseId: row.warehouseId,
    warehouseType: row.warehouseType,
    supplierId: row.supplierId,
    available: row.available,
  })),
}, null, 2));
