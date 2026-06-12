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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateSupplierImportPayload(payload: unknown): ImportPayloadValidationResult {
  if (!Array.isArray(payload)) {
    return {
      valid: false,
      totalProducts: 0,
      errors: [{ index: -1, field: 'payload', error: 'Supplier import payload must be an array of normalized items' }],
    };
  }

  const errors: ImportValidationError[] = [];

  payload.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push({ index, field: 'item', error: 'Supplier import item must be an object' });
      return;
    }

    if (!hasNonEmptyString(item.supplierSku)) {
      errors.push({ index, field: 'supplierSku', error: 'supplierSku is required before downstream writes' });
    }
  });

  return {
    valid: errors.length === 0,
    totalProducts: payload.length,
    errors,
  };
}
