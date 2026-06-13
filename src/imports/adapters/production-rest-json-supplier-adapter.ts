import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { createHash } from "crypto";
import { firstValueFrom } from "rxjs";
import {
  NormalizedSupplierImportItem,
  SupplierAdapterRunContext,
  SupplierAdapterRunSupplier,
  SupplierAdapterResult,
  SupplierImportAdapter,
} from "./supplier-import-adapter";

export const PRODUCTION_REST_JSON_ADAPTER_KEY = "rest";

@Injectable()
export class ProductionRestJsonSupplierAdapter implements SupplierImportAdapter {
  readonly metadata = {
    adapterKey: PRODUCTION_REST_JSON_ADAPTER_KEY,
    sourceType: "rest" as const,
    contractVersion: "PRODUCTION-REST-JSON-V1",
    supportsSyntheticValidation: true,
  };

  constructor(private readonly httpService: HttpService) {}

  async fetchNormalizedItems(context: SupplierAdapterRunContext): Promise<SupplierAdapterResult> {
    const supplier = context.supplier;
    if (!supplier?.apiUrl) {
      throw new Error("REST supplier apiUrl is required for production adapter");
    }

    const url = new URL(supplier.apiUrl);
    if (url.protocol !== "https:" && process.env.SUPPLIER_REST_JSON_ALLOW_HTTP !== "true") {
      throw new Error("REST supplier apiUrl must use HTTPS");
    }

    const response = await firstValueFrom(this.httpService.get(supplier.apiUrl, {
      headers: this.buildHeaders(supplier.apiCredentials || null),
      timeout: Number(process.env.SUPPLIER_REST_JSON_TIMEOUT_MS || 15000),
      maxRedirects: 0,
      responseType: "json",
    }));

    const rawItems = this.extractItems(response.data);
    const items = rawItems.map((item, index) => this.normalizeItem(item, index, context));

    return {
      adapterKey: this.metadata.adapterKey,
      sourceFingerprint: context.sourceFingerprint || this.buildSourceFingerprint(supplier.code, items),
      items,
    };
  }

  private buildHeaders(refs: SupplierAdapterRunSupplier["apiCredentials"]): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (!refs) return headers;

    const apiKey = this.readRuntimeSecret(refs.apiKeyRef);
    if (apiKey) headers["X-API-Key"] = apiKey;

    const token = this.readRuntimeSecret(refs.tokenRef);
    if (token) headers.Authorization = "Bearer " + token;

    const username = this.readRuntimeSecret(refs.usernameRef);
    const password = this.readRuntimeSecret(refs.passwordRef);
    if (username && password) {
      headers.Authorization = "Basic " + Buffer.from(username + ":" + password).toString("base64");
    }

    return headers;
  }

  private readRuntimeSecret(ref?: string): string | undefined {
    if (!ref) return undefined;
    return process.env[ref];
  }

  private extractItems(payload: unknown): Array<Record<string, unknown>> {
    const candidate = Array.isArray(payload)
      ? payload
      : this.isRecord(payload) && Array.isArray(payload.items)
        ? payload.items
        : null;

    if (!candidate) {
      throw new Error("REST supplier payload must be a JSON array or an object with an items array");
    }

    return candidate.map((item, index) => {
      if (!this.isRecord(item)) {
        throw new Error("REST supplier item at index " + index + " must be an object");
      }
      return item;
    });
  }

  private normalizeItem(item: Record<string, unknown>, index: number, context: SupplierAdapterRunContext): NormalizedSupplierImportItem {
    const supplierSku = this.requiredString(item.supplierSku, "supplierSku", index);
    const stockQuantity = this.requiredNonNegativeInteger(item.stockQuantity, "stockQuantity", index);
    const sourceRecordId = this.optionalString(item.sourceRecordId) || supplierSku;

    return {
      supplierSku,
      stockQuantity,
      sourceRecordId,
      replayKey: this.buildReplayKey(context.idempotencyKey, sourceRecordId),
      productId: this.optionalString(item.productId),
      warehouseId: this.optionalString(item.warehouseId),
      supplierId: this.optionalString(item.supplierId) || context.supplierId,
      observedAt: this.optionalString(item.observedAt),
    };
  }

  private requiredString(value: unknown, field: string, index: number): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("REST supplier item at index " + index + " is missing " + field);
    }
    return value.trim();
  }

  private requiredNonNegativeInteger(value: unknown, field: string, index: number): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error("REST supplier item at index " + index + " has invalid " + field);
    }
    return value;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  }

  private buildReplayKey(idempotencyKey: string, sourceRecordId: string): string {
    return createHash("sha256").update([idempotencyKey, sourceRecordId].join(":")).digest("hex").slice(0, 32);
  }

  private buildSourceFingerprint(supplierCode: string, items: NormalizedSupplierImportItem[]): string {
    const seed = JSON.stringify({ supplierCode, records: items.map((item) => item.sourceRecordId).sort() });
    return "rest-json-v1:" + createHash("sha256").update(seed).digest("hex").slice(0, 32);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
