export type SupplierAdapterSourceType = "rest" | "xml" | "csv" | "ftp" | "synthetic";

export interface SupplierAdapterMetadata {
  adapterKey: string;
  sourceType: SupplierAdapterSourceType;
  contractVersion: string;
  supportsSyntheticValidation: boolean;
}

export interface SupplierAdapterRunSupplier {
  id: string;
  code: string;
  apiType: SupplierAdapterSourceType;
  apiUrl?: string | null;
  apiCredentials?: {
    apiKeyRef?: string;
    usernameRef?: string;
    passwordRef?: string;
    tokenRef?: string;
  } | null;
}

export interface SupplierAdapterRunContext {
  supplierId: string;
  idempotencyKey: string;
  sourceFingerprint?: string;
  supplier?: SupplierAdapterRunSupplier;
}

export interface NormalizedSupplierImportItem {
  supplierSku: string;
  stockQuantity: number;
  sourceRecordId: string;
  replayKey: string;
  productId?: string;
  warehouseId?: string;
  supplierId?: string;
  observedAt?: string;
}

export interface SupplierAdapterResult {
  adapterKey: string;
  sourceFingerprint: string;
  items: NormalizedSupplierImportItem[];
}

export interface SupplierImportAdapter {
  readonly metadata: SupplierAdapterMetadata;
  fetchNormalizedItems(context: SupplierAdapterRunContext): Promise<SupplierAdapterResult>;
}

export interface SupplierAdapterValidationResult {
  valid: boolean;
  adapterKey: string;
  sourceFingerprint: string;
  totalItems: number;
  errors: Array<{ index: number; field: string; error: string }>;
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateSupplierAdapterResult(result: SupplierAdapterResult): SupplierAdapterValidationResult {
  const errors: SupplierAdapterValidationResult["errors"] = [];

  if (!hasNonEmptyString(result.adapterKey)) {
    errors.push({ index: -1, field: "adapterKey", error: "Adapter key is required" });
  }

  if (!hasNonEmptyString(result.sourceFingerprint)) {
    errors.push({ index: -1, field: "sourceFingerprint", error: "Source fingerprint is required for replay safety" });
  }

  if (!Array.isArray(result.items)) {
    return {
      valid: false,
      adapterKey: result.adapterKey || "unknown",
      sourceFingerprint: result.sourceFingerprint || "unknown",
      totalItems: 0,
      errors: errors.concat([{ index: -1, field: "items", error: "Adapter result items must be an array" }]),
    };
  }

  result.items.forEach((item, index) => {
    if (!hasNonEmptyString(item.sourceRecordId)) {
      errors.push({ index, field: "sourceRecordId", error: "sourceRecordId is required for deterministic replay" });
    }

    if (!hasNonEmptyString(item.replayKey)) {
      errors.push({ index, field: "replayKey", error: "replayKey is required for duplicate detection" });
    }
  });

  return {
    valid: errors.length === 0,
    adapterKey: result.adapterKey || "unknown",
    sourceFingerprint: result.sourceFingerprint || "unknown",
    totalItems: result.items.length,
    errors,
  };
}
