import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 100, unique: true })
  code: string;

  // API connection type: rest, xml, csv, ftp
  @Column({ length: 50 })
  apiType: string;

  @Column({ length: 500, nullable: true })
  apiUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  apiCredentials: {
    apiKey?: string;
    username?: string;
    password?: string;
    token?: string;
  };

  // Sync schedule (cron expression)
  @Column({ length: 100, nullable: true })
  syncSchedule: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  @Column({ length: 50, nullable: true })
  lastSyncStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

