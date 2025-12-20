import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ImportJob } from './import-job.entity';

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(ImportJob)
    private readonly importJobRepository: Repository<ImportJob>,
    private readonly httpService: HttpService,
  ) {}

  async createJob(supplierId: string): Promise<ImportJob> {
    const job = this.importJobRepository.create({ supplierId });
    return this.importJobRepository.save(job);
  }

  async findJobs(supplierId?: string): Promise<ImportJob[]> {
    const where = supplierId ? { supplierId } : {};
    return this.importJobRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async updateJob(id: string, data: Partial<ImportJob>): Promise<ImportJob> {
    await this.importJobRepository.update(id, data);
    return this.importJobRepository.findOne({ where: { id } });
  }

  async runImport(jobId: string, supplierId: string): Promise<void> {
    await this.updateJob(jobId, { status: 'running', startedAt: new Date() });

    try {
      // Fetch products from catalog-microservice
      const catalogUrl = process.env.CATALOG_SERVICE_URL || 'http://catalog-microservice:3200';

      // Import logic would go here
      // 1. Fetch from supplier API
      // 2. Transform to catalog format
      // 3. POST to catalog-microservice
      // 4. Update stock via warehouse-microservice

      await this.updateJob(jobId, {
        status: 'completed',
        completedAt: new Date(),
      });
    } catch (error) {
      await this.updateJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
        errors: [{ sku: 'N/A', error: error.message }],
      });
    }
  }
}

