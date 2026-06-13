import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";
import { ImportTriggerType } from "./dto/import-run.dto";
import { ImportValidationError, WarehouseStockBoundaryPolicy } from "./import-validation";

@Entity("import_jobs")
@Index(["supplierId", "idempotencyKey"], { unique: true })
export class ImportJob {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  supplierId: string;

  @Column({ length: 128 })
  idempotencyKey: string;

  @Column({ length: 50, default: "manual" })
  triggerType: ImportTriggerType;

  @Column({ length: 256, nullable: true })
  sourceFingerprint: string;

  @Column({ length: 50, default: "pending" })
  status: string;

  @Column({ length: 50, default: "pending" })
  payloadValidationStatus: string;

  @Column({ type: "jsonb", nullable: true })
  payloadValidationErrors: ImportValidationError[];

  @Column({ length: 50, default: "pending" })
  catalogProductValidationStatus: string;

  @Column({ type: "jsonb", nullable: true })
  catalogProductValidationErrors: ImportValidationError[];

  @Column({ type: "jsonb", nullable: true })
  catalogProductIdsChecked: string[];

  @Column({ length: 50, default: "pending" })
  warehouseStockValidationStatus: string;

  @Column({ type: "jsonb", nullable: true })
  warehouseStockValidationErrors: ImportValidationError[];

  @Column({ type: "jsonb", nullable: true })
  warehouseStockUpdatePolicy: WarehouseStockBoundaryPolicy;

  @Column({ type: "boolean", default: false })
  warehouseStockUpdateAttempted: boolean;

  @Column({ type: "boolean", default: false })
  warehouseStockUpdateApproved: boolean;

  @Column({ type: "int", default: 0 })
  totalProducts: number;

  @Column({ type: "int", default: 0 })
  importedProducts: number;

  @Column({ type: "int", default: 0 })
  updatedProducts: number;

  @Column({ type: "int", default: 0 })
  failedProducts: number;

  @Column({ type: "jsonb", nullable: true })
  errors: { sku: string; error: string }[];

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
