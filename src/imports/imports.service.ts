import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HttpService } from "@nestjs/axios";
import { createHash } from "crypto";
import { firstValueFrom } from "rxjs";
import { ImportJob } from "./import-job.entity";
import { RunImportDto, ImportTriggerType } from "./dto/import-run.dto";
import {
  validateSupplierImportPayload,
  validateWarehouseStockUpdateBoundary,
  WarehouseStockBoundaryOptions,
  WarehouseStockBoundaryPolicy,
} from "./import-validation";
import { SupplierAdapterRegistry, SupplierAdapterNotFoundError } from "./adapters/supplier-adapter-registry";
import { NormalizedSupplierImportItem, validateSupplierAdapterResult } from "./adapters/supplier-import-adapter";
import { Supplier } from "../suppliers/supplier.entity";

export interface ImportJobStart {
  job: ImportJob;
  created: boolean;
  shouldRun: boolean;
}

export interface WarehouseReconciliationResult {
  policy: WarehouseStockBoundaryPolicy;
  totalStockUpdates: number;
  appliedUpdates: number;
  errors: Array<{ sku: string; error: string }>;
}

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(ImportJob)
    private readonly importJobRepository: Repository<ImportJob>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly httpService: HttpService,
    private readonly adapterRegistry: SupplierAdapterRegistry,
  ) {}

  async createOrReuseJob(supplierId: string, options: RunImportDto = {}): Promise<ImportJobStart> {
    await this.assertSupplierCanImport(supplierId);

    const triggerType = options.triggerType || "manual";
    const idempotencyKey = this.buildIdempotencyKey(supplierId, triggerType, options);
    const existing = await this.importJobRepository.findOne({ where: { supplierId, idempotencyKey } });

    if (existing) {
      return { job: existing, created: false, shouldRun: false };
    }

    const job = this.importJobRepository.create({
      supplierId,
      idempotencyKey,
      triggerType,
      sourceFingerprint: options.sourceFingerprint,
      payloadValidationStatus: "pending",
      warehouseStockValidationStatus: "pending",
      warehouseStockUpdateAttempted: false,
      warehouseStockUpdateApproved: false,
    });

    try {
      return { job: await this.importJobRepository.save(job), created: true, shouldRun: true };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replayed = await this.importJobRepository.findOne({ where: { supplierId, idempotencyKey } });
        if (replayed) return { job: replayed, created: false, shouldRun: false };
      }
      throw error;
    }
  }

  async findJobs(supplierId?: string): Promise<ImportJob[]> {
    const where = supplierId ? { supplierId } : {};
    return this.importJobRepository.find({
      where,
      order: { createdAt: "DESC" },
      take: 50,
    });
  }

  async updateJob(id: string, data: Partial<ImportJob>): Promise<ImportJob> {
    await this.importJobRepository.update(id, data);
    return this.importJobRepository.findOne({ where: { id } });
  }

  async runImport(jobId: string, supplierId: string, _options: RunImportDto = {}): Promise<void> {
    const job = await this.importJobRepository.findOne({ where: { id: jobId, supplierId } });
    if (!job) throw new NotFoundException("Import job " + jobId + " not found");
    if (job.status === "running") return;

    await this.updateJob(jobId, {
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      payloadValidationStatus: "pending",
      payloadValidationErrors: null,
      warehouseStockValidationStatus: "pending",
      warehouseStockValidationErrors: null,
      warehouseStockUpdatePolicy: null,
      warehouseStockUpdateAttempted: false,
      warehouseStockUpdateApproved: false,
      errors: null,
    });

    try {
      const supplier = await this.assertSupplierCanImport(supplierId);
      const adapter = this.adapterRegistry.requireForSupplier(supplierId, supplier.code);
      const adapterResult = await adapter.fetchNormalizedItems({
        supplierId,
        idempotencyKey: job.idempotencyKey,
        sourceFingerprint: job.sourceFingerprint,
      });
      const adapterValidation = validateSupplierAdapterResult(adapterResult);

      if (!adapterValidation.valid) {
        await this.updateJob(jobId, {
          status: "failed",
          completedAt: new Date(),
          totalProducts: adapterValidation.totalItems,
          failedProducts: adapterValidation.errors.length,
          payloadValidationStatus: "failed",
          payloadValidationErrors: adapterValidation.errors,
          warehouseStockValidationStatus: "blocked",
          warehouseStockValidationErrors: [{ index: -1, field: "adapter", error: "Supplier adapter contract validation failed before downstream writes" }],
          warehouseStockUpdateAttempted: false,
          warehouseStockUpdateApproved: false,
          errors: adapterValidation.errors.map((item) => ({ sku: "N/A", error: item.field + ": " + item.error })),
        });
        return;
      }

      const normalizedSupplierPayload = adapterResult.items;
      const validation = validateSupplierImportPayload(normalizedSupplierPayload);

      if (!validation.valid) {
        await this.updateJob(jobId, {
          status: "failed",
          completedAt: new Date(),
          totalProducts: validation.totalProducts,
          failedProducts: validation.errors.length,
          payloadValidationStatus: "failed",
          payloadValidationErrors: validation.errors,
          warehouseStockValidationStatus: "blocked",
          warehouseStockValidationErrors: [{ index: -1, field: "payload", error: "Supplier payload validation failed before Warehouse stock validation" }],
          warehouseStockUpdateAttempted: false,
          warehouseStockUpdateApproved: false,
          errors: validation.errors.map((item) => ({ sku: "N/A", error: item.field + ": " + item.error })),
        });
        return;
      }

      const warehouseReconciliation = await this.reconcileWarehouseStockCandidates(
        supplierId,
        job,
        normalizedSupplierPayload as NormalizedSupplierImportItem[],
        {
          actor: "suppliers-microservice",
          reason: "supplier-import",
          idempotencyKey: job.idempotencyKey,
          approvedForMutation: false,
          mutationAttempted: false,
        },
      );

      const warehouseBoundary = {
        valid: warehouseReconciliation.errors.length === 0,
        totalStockUpdates: warehouseReconciliation.totalStockUpdates,
        errors: warehouseReconciliation.errors.map((item, index) => ({ index, field: "warehouse", error: item.error })),
        policy: warehouseReconciliation.policy,
      };

      if (!warehouseBoundary.valid) {
        await this.updateJob(jobId, {
          status: "failed",
          completedAt: new Date(),
          totalProducts: validation.totalProducts,
          failedProducts: warehouseBoundary.errors.length,
          payloadValidationStatus: "passed",
          payloadValidationErrors: [],
          warehouseStockValidationStatus: "failed",
          warehouseStockValidationErrors: warehouseBoundary.errors,
          warehouseStockUpdatePolicy: warehouseBoundary.policy,
          warehouseStockUpdateAttempted: warehouseBoundary.policy.mutationAttempted,
          warehouseStockUpdateApproved: warehouseBoundary.policy.approvedForMutation,
          errors: warehouseBoundary.errors.map((item) => ({ sku: "N/A", error: item.field + ": " + item.error })),
        });
        return;
      }

      await this.updateJob(jobId, {
        status: "completed",
        completedAt: new Date(),
        totalProducts: validation.totalProducts,
        importedProducts: 0,
        updatedProducts: warehouseReconciliation.appliedUpdates,
        failedProducts: 0,
        payloadValidationStatus: "passed",
        payloadValidationErrors: [],
        warehouseStockValidationStatus: "passed",
        warehouseStockValidationErrors: [],
        warehouseStockUpdatePolicy: warehouseBoundary.policy,
        warehouseStockUpdateAttempted: warehouseBoundary.policy.mutationAttempted,
        warehouseStockUpdateApproved: warehouseBoundary.policy.approvedForMutation,
      });
    } catch (error) {
      await this.recordImportFailure(jobId, error);
    }
  }

  async reconcileWarehouseStockCandidates(
    supplierId: string,
    job: Pick<ImportJob, "idempotencyKey">,
    candidates: NormalizedSupplierImportItem[],
    options: WarehouseStockBoundaryOptions,
  ): Promise<WarehouseReconciliationResult> {
    const boundary = validateWarehouseStockUpdateBoundary(candidates, options);
    const errors = boundary.errors.map((item) => ({ sku: "N/A", error: item.field + ": " + item.error }));

    if (!boundary.valid) {
      return {
        policy: boundary.policy,
        totalStockUpdates: boundary.totalStockUpdates,
        appliedUpdates: 0,
        errors,
      };
    }

    if (!boundary.policy.approvedForMutation || !boundary.policy.mutationAttempted || candidates.length === 0) {
      return {
        policy: boundary.policy,
        totalStockUpdates: boundary.totalStockUpdates,
        appliedUpdates: 0,
        errors: [],
      };
    }

    const token = process.env.WAREHOUSE_SERVICE_TOKEN || process.env.WAREHOUSE_INTERNAL_SERVICE_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException("Warehouse service token is not configured");
    }

    const baseUrl = (process.env.WAREHOUSE_SERVICE_URL || process.env.WAREHOUSE_BASE_URL || "http://warehouse-microservice:3201").replace(/\/$/, "");
    let appliedUpdates = 0;

    for (const candidate of candidates) {
      try {
        await firstValueFrom(this.httpService.post(
          baseUrl + "/api/supplier-reconciliations",
          {
            supplierId,
            warehouseId: candidate.warehouseId,
            productId: candidate.productId,
            quantity: candidate.stockQuantity,
            externalReference: this.buildWarehouseExternalReference(job.idempotencyKey, candidate),
            actor: options.actor,
            observedAt: candidate.observedAt,
          },
          {
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
            timeout: Number(process.env.WAREHOUSE_RECONCILIATION_TIMEOUT_MS || 5000),
          },
        ));
        appliedUpdates += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Warehouse reconciliation failed";
        return {
          policy: boundary.policy,
          totalStockUpdates: boundary.totalStockUpdates,
          appliedUpdates,
          errors: [{ sku: candidate.supplierSku, error: message }],
        };
      }
    }

    return {
      policy: boundary.policy,
      totalStockUpdates: boundary.totalStockUpdates,
      appliedUpdates,
      errors: [],
    };
  }

  private async assertSupplierCanImport(supplierId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException("Supplier " + supplierId + " not found");
    if (!supplier.isActive) throw new BadRequestException("Supplier " + supplierId + " is inactive");
    return supplier;
  }

  private async recordImportFailure(jobId: string, error: unknown): Promise<void> {
    const message = this.sanitizeImportError(error);
    const isMissingAdapter = error instanceof SupplierAdapterNotFoundError;

    await this.updateJob(jobId, {
      status: "failed",
      completedAt: new Date(),
      totalProducts: 0,
      failedProducts: 1,
      payloadValidationStatus: isMissingAdapter ? "blocked" : "failed",
      payloadValidationErrors: [{ index: -1, field: isMissingAdapter ? "adapter" : "import", error: message }],
      warehouseStockValidationStatus: "blocked",
      warehouseStockValidationErrors: [{ index: -1, field: "warehouse", error: "Warehouse stock validation blocked before downstream writes" }],
      warehouseStockUpdateAttempted: false,
      warehouseStockUpdateApproved: false,
      errors: [{ sku: "N/A", error: message }],
    });
  }

  private sanitizeImportError(error: unknown): string {
    if (error instanceof SupplierAdapterNotFoundError) {
      return error.message;
    }

    if (error instanceof Error && error.message) {
      return error.message.replace(/(bearer|token|password|secret|key)\s+[^\s]+/gi, "$1 [REDACTED]");
    }

    return "Import failed";
  }

  private buildIdempotencyKey(supplierId: string, triggerType: ImportTriggerType, options: RunImportDto): string {
    if (options.idempotencyKey) return options.idempotencyKey.trim();

    const replayWindow = new Date().toISOString().slice(0, 13);
    const seed = supplierId + ":" + triggerType + ":" + (options.sourceFingerprint || replayWindow);
    const digest = createHash("sha256").update(seed).digest("hex").slice(0, 32);
    return triggerType + ":" + digest;
  }

  private buildWarehouseExternalReference(idempotencyKey: string, candidate: NormalizedSupplierImportItem): string {
    const seed = [idempotencyKey, candidate.supplierSku, candidate.productId, candidate.warehouseId].join(":");
    return "supplier-import:" + createHash("sha256").update(seed).digest("hex").slice(0, 48);
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
  }
}
