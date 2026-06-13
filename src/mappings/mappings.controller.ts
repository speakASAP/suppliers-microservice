import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { SetCategoryMappingDto } from './dto/set-category-mapping.dto';
import { ValidateCategoryMappingsDto } from './dto/validate-category-mappings.dto';
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
  async setMapping(@Body() body: SetCategoryMappingDto) {
    const mapping = await this.mappingsService.setMapping(body);
    return { success: true, data: mapping };
  }

  @Post('supplier/:supplierId/validate')
  async validateSupplierMappings(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() body: ValidateCategoryMappingsDto,
  ) {
    const result = await this.mappingsService.validateSupplierCategories(supplierId, body.supplierCategoryIds);
    return { success: true, data: result };
  }
}
