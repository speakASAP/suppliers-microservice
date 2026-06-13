import { Injectable } from "@nestjs/common";
import {
  SupplierAdapterRunContext,
  SupplierAdapterResult,
  SupplierImportAdapter,
} from "./supplier-import-adapter";

const SYNTHETIC_TRACE_ADAPTER_KEY = "synthetic-trace";

@Injectable()
export class SyntheticTraceSupplierAdapter implements SupplierImportAdapter {
  readonly metadata = {
    adapterKey: SYNTHETIC_TRACE_ADAPTER_KEY,
    sourceType: "synthetic" as const,
    contractVersion: "2026-06-13",
    supportsSyntheticValidation: true,
  };

  async fetchNormalizedItems(context: SupplierAdapterRunContext): Promise<SupplierAdapterResult> {
    const sourceFingerprint = context.sourceFingerprint?.trim() || "";
    const parsed = this.parseSourceFingerprint(sourceFingerprint);

    return {
      adapterKey: SYNTHETIC_TRACE_ADAPTER_KEY,
      sourceFingerprint,
      items: [{
        sourceRecordId: "synthetic-trace:" + parsed.productId + ":" + parsed.warehouseId,
        replayKey: [context.idempotencyKey, parsed.productId, parsed.warehouseId, parsed.supplierSku].join(":"),
        supplierSku: parsed.supplierSku,
        productId: parsed.productId,
        warehouseId: parsed.warehouseId,
        stockQuantity: parsed.stockQuantity,
        observedAt: parsed.observedAt,
      }],
    };
  }

  private parseSourceFingerprint(sourceFingerprint: string): {
    productId: string;
    warehouseId: string;
    stockQuantity: number;
    supplierSku: string;
    observedAt: string;
  } {
    const parts = sourceFingerprint.split(":");
    if (parts.length < 4 || parts[0] !== "trace") {
      throw new Error("Synthetic trace sourceFingerprint must be trace:<productId>:<warehouseId>:<quantity>[:supplierSku]");
    }

    const [, productId, warehouseId, quantityValue, supplierSkuValue] = parts;
    const stockQuantity = Number(quantityValue);
    if (!productId || !warehouseId || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw new Error("Synthetic trace sourceFingerprint contains invalid product, warehouse, or quantity");
    }

    return {
      productId,
      warehouseId,
      stockQuantity,
      supplierSku: supplierSkuValue || "SUP-SKU-TRACE",
      observedAt: new Date().toISOString(),
    };
  }
}

export { SYNTHETIC_TRACE_ADAPTER_KEY };
