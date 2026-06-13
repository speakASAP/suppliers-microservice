import { Injectable } from "@nestjs/common";
import { SupplierImportAdapter } from "./supplier-import-adapter";

export class SupplierAdapterNotFoundError extends Error {
  constructor(readonly supplierId: string) {
    super("No supplier adapter is registered for this supplier contract");
    this.name = "SupplierAdapterNotFoundError";
  }
}

@Injectable()
export class SupplierAdapterRegistry {
  private readonly adapters = new Map<string, SupplierImportAdapter>();

  register(adapter: SupplierImportAdapter): void {
    this.adapters.set(adapter.metadata.adapterKey, adapter);
  }

  get(adapterKey: string): SupplierImportAdapter | undefined {
    return this.adapters.get(adapterKey);
  }

  requireForSupplier(supplierId: string, ...adapterKeys: Array<string | null | undefined>): SupplierImportAdapter {
    for (const adapterKey of adapterKeys) {
      if (!adapterKey) continue;
      const adapter = this.get(adapterKey);
      if (adapter) return adapter;
    }

    throw new SupplierAdapterNotFoundError(supplierId);
  }

  listMetadata(): Array<SupplierImportAdapter["metadata"]> {
    return Array.from(this.adapters.values()).map((adapter) => adapter.metadata);
  }
}
