import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HttpService } from "@nestjs/axios";
import { createHash } from "crypto";
import { ImportJob } from "./import-job.entity";
import { RunImportDto, ImportTriggerType } from "./dto/import-run.dto";
import { validateSupplierImportPayload, validateWarehouseStockUpdateBoundary } from "./import-validation";
import { Supplier } from "../suppliers/supplier.entity";

export interface ImportJobStart {
  job: ImportJob;
  created: boolean;
  shouldRun: boolean;
}

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(ImportJob)
    private readonly importJobRepository: Repository<ImportJob>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly httpService: HttpService,
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

  async runImport(jobId: string, supplierId: string): Promise<void> {
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
      const normalizedSupplierPayload: unknown[] = [];
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

      const warehouseBoundary = validateWarehouseStockUpdateBoundary(normalizedSupplierPayload, {
        actor: "suppliers-microservice",
        reason: "supplier-import",
        idempotencyKey: job.idempotencyKey,
        approvedForMutation: false,
        mutationAttempted: false,
      });

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
        updatedProducts: 0,
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
      const message = error instanceof Error ? error.message : "Import failed";
      await this.updateJob(jobId, {
        status: "failed",
        completedAt: new Date(),
        errors: [{ sku: "N/A", error: message }],
      });
    }
  }

  private async assertSupplierCanImport(supplierId: string): Promise<void> {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException("Supplier " + supplierId + " not found");
    if (!supplier.isActive) throw new BadRequestException("Supplier " + supplierId + " is inactive");
  }

  private buildIdempotencyKey(supplierId: string, triggerType: ImportTriggerType, options: RunImportDto): string {
    if (options.idempotencyKey) return options.idempotencyKey.trim();

    const replayWindow = new Date().toISOString().slice(0, 13);
    const seed = supplierId + ":" + triggerType + ":" + (options.sourceFingerprint || replayWindow);
    const digest = createHash("sha256").update(seed).digest("hex").slice(0, 32);
    return triggerType + ":" + digest;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
  }
}
