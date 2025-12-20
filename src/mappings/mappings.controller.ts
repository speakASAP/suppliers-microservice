import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { MappingsService } from './mappings.service';

@Controller('mappings')
export class MappingsController {
  constructor(private readonly mappingsService: MappingsService) {}

  @Get('supplier/:supplierId')
  async findBySupplier(@Param('supplierId', ParseUUIDPipe) supplierId: string) {
    const mappings = await this.mappingsService.findBySupplier(supplierId);
    return { success: true, data: mappings };
  }

  @Post()
  async setMapping(@Body() body: { supplierId: string; supplierCategoryId: string; catalogCategoryId: string }) {
    const mapping = await this.mappingsService.setMapping(
      body.supplierId,
      body.supplierCategoryId,
      body.catalogCategoryId
    );
    return { success: true, data: mapping };
  }
}

