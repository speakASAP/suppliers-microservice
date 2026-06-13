export interface ImportValidationError {
  index: number;
  field: string;
  error: string;
}

export interface ImportPayloadValidationResult {
  valid: boolean;
  totalProducts: number;
  errors: ImportValidationError[];
}

export interface NormalizedWarehouseStockCandidate {
  supplierSku: string;
  productId: string;
  warehouseId: string;
  stockQuantity: number;
  observedAt?: string;
}

export interface WarehouseStockBoundaryPolicy {
  actor: string;
  reason: string;
  idempotencyKey: string;
  warehouseAuthority: string;
  approvedForMutation: boolean;
  mutationAttempted: boolean;
}

export interface WarehouseStockBoundaryValidationResult {
  valid: boolean;
  totalStockUpdates: number;
  errors: ImportValidationError[];
  policy: WarehouseStockBoundaryPolicy;
}

export interface WarehouseStockBoundaryOptions {
  actor: string;
  reason: string;
  idempotencyKey: string;
  approvedForMutation?: boolean;
  mutationAttempted?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function validateSupplierImportPayload(payload: unknown): ImportPayloadValidationResult {
  if (!Array.isArray(payload)) {
    return {
      valid: false,
      totalProducts: 0,
      errors: [{ index: -1, field: "payload", error: "Supplier import payload must be an array of normalized items" }],
    };
  }

  const errors: ImportValidationError[] = [];

  payload.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push({ index, field: "item", error: "Supplier import item must be an object" });
      return;
    }

    if (!hasNonEmptyString(item.supplierSku)) {
      errors.push({ index, field: "supplierSku", error: "supplierSku is required before downstream writes" });
    }
  });

  return {
    valid: errors.length === 0,
    totalProducts: payload.length,
    errors,
  };
}

export function validateWarehouseStockUpdateBoundary(
  payload: unknown,
  options: WarehouseStockBoundaryOptions,
): WarehouseStockBoundaryValidationResult {
  const policy: WarehouseStockBoundaryPolicy = {
    actor: options.actor,
    reason: options.reason,
    idempotencyKey: options.idempotencyKey,
    warehouseAuthority: "warehouse-microservice",
    approvedForMutation: options.approvedForMutation === true,
    mutationAttempted: options.mutationAttempted === true,
  };

  if (!Array.isArray(payload)) {
    return {
      valid: false,
      totalStockUpdates: 0,
      errors: [{ index: -1, field: "payload", error: "Warehouse stock payload must be an array of normalized stock candidates" }],
      policy,
    };
  }

  const errors: ImportValidationError[] = [];

  payload.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push({ index, field: "item", error: "Warehouse stock candidate must be an object" });
      return;
    }

    if (!hasNonEmptyString(item.supplierSku)) {
      errors.push({ index, field: "supplierSku", error: "supplierSku is required before Warehouse stock validation" });
    }

    if (!hasNonEmptyString(item.productId)) {
      errors.push({ index, field: "productId", error: "productId is required before Warehouse stock validation" });
    }

    if (!hasNonEmptyString(item.warehouseId)) {
      errors.push({ index, field: "warehouseId", error: "warehouseId is required before Warehouse stock validation" });
    }

    if (!isNonNegativeInteger(item.stockQuantity)) {
      errors.push({ index, field: "stockQuantity", error: "stockQuantity must be a non-negative integer" });
    }

    if (item.observedAt !== undefined) {
      const observedAt = hasNonEmptyString(item.observedAt) ? new Date(String(item.observedAt)) : null;
      if (!observedAt || Number.isNaN(observedAt.getTime())) {
        errors.push({ index, field: "observedAt", error: "observedAt must be a valid date string when provided" });
      }
    }

    if (item.warehouseLocationId !== undefined && !hasNonEmptyString(item.warehouseLocationId)) {
      errors.push({ index, field: "warehouseLocationId", error: "warehouseLocationId must be a non-empty string when provided" });
    }
  });

  if (policy.mutationAttempted && !policy.approvedForMutation) {
    errors.push({ index: -1, field: "approval", error: "Warehouse stock mutation requires owner-approved execution" });
  }

  return {
    valid: errors.length === 0,
    totalStockUpdates: payload.length,
    errors,
    policy,
  };
}
