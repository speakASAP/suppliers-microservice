import { Body, Controller, Get, Post, Param, Query, ParseUUIDPipe, Req } from '@nestjs/common';
import type { AuthenticatedSupplierRequest } from '../auth/jwt-roles.guard';
import { SuppliersService } from '../suppliers/suppliers.service';
import type { SupplierActor } from '../suppliers/suppliers.service';
import { ImportsService } from './imports.service';
import { RunImportDto } from './dto/import-run.dto';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  @Get()
  async findJobs(@Query('supplierId') supplierId?: string, @Req() request?: AuthenticatedSupplierRequest) {
    const actor = this.actorFromRequest(request);
    if (supplierId) {
      await this.suppliersService.assertSupplierVisible(supplierId, actor);
      const jobs = await this.importsService.findJobs(supplierId);
      return { success: true, data: jobs };
    }

    const suppliers = await this.suppliersService.findAll(actor);
    const jobs = await this.importsService.findJobsBySupplierIds(suppliers.map((supplier) => supplier.id));
    return { success: true, data: jobs };
  }

  @Post('run/:supplierId')
  async runImport(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() options: RunImportDto = {},
    @Req() request?: AuthenticatedSupplierRequest,
  ) {
    await this.suppliersService.assertSupplierVisible(supplierId, this.actorFromRequest(request));
    const start = await this.importsService.createOrReuseJob(supplierId, options);
    if (start.shouldRun) {
      void this.importsService.runImport(start.job.id, supplierId, options);
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

  private actorFromRequest(request?: AuthenticatedSupplierRequest): SupplierActor {
    return {
      sub: request?.user?.sub || '',
      email: request?.user?.email,
      roles: request?.user?.roles || [],
    };
  }
}
