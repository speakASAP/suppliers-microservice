import { Controller, Get, Post, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Supplier } from './supplier.entity';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async findAll() {
    const suppliers = await this.suppliersService.findAll();
    return { success: true, data: suppliers };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const supplier = await this.suppliersService.findOne(id);
    return { success: true, data: supplier };
  }

  @Post()
  async create(@Body() data: Partial<Supplier>) {
    const supplier = await this.suppliersService.create(data);
    return { success: true, data: supplier };
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<Supplier>) {
    const supplier = await this.suppliersService.update(id, data);
    return { success: true, data: supplier };
  }
}

