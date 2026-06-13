import { Injectable } from "@nestjs/common";
import {
  SupplierAdapterRunContext,
  SupplierAdapterResult,
  SupplierImportAdapter,
} from "./supplier-import-adapter";

const SYNTHETIC_TRACE_ADAPTER_KEY = "synthetic-trace";

type SyntheticTraceItem = {
  productId: string;
  warehouseId: string;
  stockQuantity: number;
  supplierSku: string;
  observedAt: string;
};

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
      items: parsed.items.map((item) => ({
        sourceRecordId: "synthetic-trace:" + item.productId + ":" + item.warehouseId,
        replayKey: [context.idempotencyKey, item.productId, item.warehouseId, item.supplierSku].join(":"),
        supplierSku: item.supplierSku,
        productId: item.productId,
        warehouseId: item.warehouseId,
        stockQuantity: item.stockQuantity,
        observedAt: item.observedAt,
      })),
    };
  }

  private parseSourceFingerprint(sourceFingerprint: string): { items: SyntheticTraceItem[] } {
    const parts = sourceFingerprint.split(":");
    if (parts[0] !== "trace") {
      throw new Error("Synthetic trace sourceFingerprint must start with trace");
    }

    if (parts.length >= 6) {
      return this.parseDualWarehouseFingerprint(parts);
    }

    return this.parseSingleWarehouseFingerprint(parts);
  }

  private parseSingleWarehouseFingerprint(parts: string[]): { items: SyntheticTraceItem[] } {
    if (parts.length < 4) {
      throw new Error("Synthetic trace sourceFingerprint must be trace:<productId>:<warehouseId>:<quantity>[:supplierSku]");
    }

    const [, productId, warehouseId, quantityValue, supplierSkuValue] = parts;
    const stockQuantity = Number(quantityValue);
    if (!productId || !warehouseId || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw new Error("Synthetic trace sourceFingerprint contains invalid product, warehouse, or quantity");
    }

    return {
      items: [{
        productId,
        warehouseId,
        stockQuantity,
        supplierSku: supplierSkuValue || "SUP-SKU-TRACE",
        observedAt: new Date().toISOString(),
      }],
    };
  }

  private parseDualWarehouseFingerprint(parts: string[]): { items: SyntheticTraceItem[] } {
    const [, productId, supplierWarehouseId, dropshipWarehouseId, quantityValue, supplierSkuValue] = parts;
    const stockQuantity = Number(quantityValue);
    if (!productId || !supplierWarehouseId || !dropshipWarehouseId || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw new Error("Synthetic trace sourceFingerprint must be trace:<productId>:<supplierWarehouseId>:<dropshipWarehouseId>:<quantity>[:supplierSku]");
    }

    const observedAt = new Date().toISOString();
    const supplierSku = supplierSkuValue || "SUP-SKU-TRACE";
    return {
      items: [
        {
          productId,
          warehouseId: supplierWarehouseId,
          stockQuantity,
          supplierSku,
          observedAt,
        },
        {
          productId,
          warehouseId: dropshipWarehouseId,
          stockQuantity,
          supplierSku,
          observedAt,
        },
      ],
    };
  }
}

export { SYNTHETIC_TRACE_ADAPTER_KEY };
