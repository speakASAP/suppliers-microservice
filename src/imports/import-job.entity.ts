import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('import_jobs')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  supplierId: string;

  // Status: pending, running, completed, failed
  @Column({ length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  totalProducts: number;

  @Column({ type: 'int', default: 0 })
  importedProducts: number;

  @Column({ type: 'int', default: 0 })
  updatedProducts: number;

  @Column({ type: 'int', default: 0 })
  failedProducts: number;

  @Column({ type: 'jsonb', nullable: true })
  errors: { sku: string; error: string }[];

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

