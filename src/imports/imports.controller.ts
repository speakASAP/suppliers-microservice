import { Body, Controller, Get, Post, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { RunImportDto } from './dto/import-run.dto';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  async findJobs(@Query('supplierId') supplierId?: string) {
    const jobs = await this.importsService.findJobs(supplierId);
    return { success: true, data: jobs };
  }

  @Post('run/:supplierId')
  async runImport(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() options: RunImportDto = {},
  ) {
    const start = await this.importsService.createOrReuseJob(supplierId, options);
    if (start.shouldRun) {
      void this.importsService.runImport(start.job.id, supplierId);
    }

    return {
      success: true,
      data: start.job,
      meta: {
        created: start.created,
        idempotentReplay: !start.created,
      },
    };
  }
}
