import { Controller, Get, Post, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  async findJobs(@Query('supplierId') supplierId?: string) {
    const jobs = await this.importsService.findJobs(supplierId);
    return { success: true, data: jobs };
  }

  @Post('run/:supplierId')
  async runImport(@Param('supplierId', ParseUUIDPipe) supplierId: string) {
    const job = await this.importsService.createJob(supplierId);
    // Run import in background
    this.importsService.runImport(job.id, supplierId);
    return { success: true, data: job };
  }
}

