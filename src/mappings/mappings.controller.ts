import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import type { AuthenticatedSupplierRequest } from '../auth/jwt-roles.guard';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SetCategoryMappingDto } from './dto/set-category-mapping.dto';
import { ValidateCategoryMappingsDto } from './dto/validate-category-mappings.dto';
import { MappingsService } from './mappings.service';

@Controller('mappings')
export class MappingsController {
  constructor(
    private readonly mappingsService: MappingsService,
    private readonly suppliersService: SuppliersService,
  ) {}

  @Get('supplier/:supplierId')
  async findBySupplier(@Param('supplierId', ParseUUIDPipe) supplierId: string, @Req() request?: AuthenticatedSupplierRequest) {
    await this.suppliersService.assertSupplierVisible(supplierId, request?.user);
    const mappings = await this.mappingsService.findBySupplier(supplierId);
    return { success: true, data: mappings };
  }

  @Post()
  async setMapping(@Body() body: SetCategoryMappingDto, @Req() request?: AuthenticatedSupplierRequest) {
    await this.suppliersService.assertSupplierVisible(body.supplierId, request?.user);
    const mapping = await this.mappingsService.setMapping(body);
    return { success: true, data: mapping };
  }

  @Post('supplier/:supplierId/validate')
  async validateSupplierMappings(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() body: ValidateCategoryMappingsDto,
    @Req() request?: AuthenticatedSupplierRequest,
  ) {
    await this.suppliersService.assertSupplierVisible(supplierId, request?.user);
    const result = await this.mappingsService.validateSupplierCategories(supplierId, body.supplierCategoryIds);
    return { success: true, data: result };
  }
}
