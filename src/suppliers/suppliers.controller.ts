import { Controller, Get, Post, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Supplier } from './supplier.entity';
import { SuppliersService } from './suppliers.service';

type SupplierResponse = Omit<Supplier, 'apiCredentials'> & { hasCredentials: boolean };

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async findAll() {
    const suppliers = await this.suppliersService.findAll();
    return { success: true, data: suppliers.map((supplier) => this.toResponse(supplier)) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const supplier = await this.suppliersService.findOne(id);
    return { success: true, data: this.toResponse(supplier) };
  }

  @Post()
  async create(@Body() data: CreateSupplierDto) {
    const supplier = await this.suppliersService.create(data);
    return { success: true, data: this.toResponse(supplier) };
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateSupplierDto) {
    const supplier = await this.suppliersService.update(id, data);
    return { success: true, data: this.toResponse(supplier) };
  }

  private toResponse(supplier: Supplier): SupplierResponse {
    const { apiCredentials, ...safeSupplier } = supplier;
    return {
      ...safeSupplier,
      hasCredentials: Boolean(apiCredentials && Object.keys(apiCredentials).length > 0),
    };
  }
}
