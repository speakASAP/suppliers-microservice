import { Roles } from '../auth/roles.decorator';
import { Controller, Get, Post, Put, Body, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import type { AuthenticatedSupplierRequest } from '../auth/jwt-roles.guard';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Supplier } from './supplier.entity';
import { SuppliersService } from './suppliers.service';
import type { SupplierActor } from './suppliers.service';
import { SUPPLIERS_READ_ROLES, SUPPLIERS_WRITE_ROLES } from '../auth/roles.constants';

type SupplierResponse = Omit<Supplier, 'apiCredentials'> & { hasCredentials: boolean };

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Roles(...SUPPLIERS_READ_ROLES)
  @Get()
  async findAll(@Req() request: AuthenticatedSupplierRequest) {
    const suppliers = await this.suppliersService.findAll(this.actorFromRequest(request));
    return { success: true, data: suppliers.map((supplier) => this.toResponse(supplier)) };
  }

  @Roles(...SUPPLIERS_READ_ROLES)
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedSupplierRequest) {
    const supplier = await this.suppliersService.findOne(id, this.actorFromRequest(request));
    return { success: true, data: this.toResponse(supplier) };
  }

  @Roles(...SUPPLIERS_WRITE_ROLES)
  @Post()
  async create(@Body() data: CreateSupplierDto, @Req() request: AuthenticatedSupplierRequest) {
    const supplier = await this.suppliersService.create(data, this.actorFromRequest(request));
    return { success: true, data: this.toResponse(supplier) };
  }

  @Roles(...SUPPLIERS_WRITE_ROLES)
  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateSupplierDto, @Req() request: AuthenticatedSupplierRequest) {
    const supplier = await this.suppliersService.update(id, data, this.actorFromRequest(request));
    return { success: true, data: this.toResponse(supplier) };
  }

  private actorFromRequest(request: AuthenticatedSupplierRequest): SupplierActor {
    return {
      sub: request.user?.sub || '',
      email: request.user?.email,
      roles: request.user?.roles || [],
    };
  }

  private toResponse(supplier: Supplier): SupplierResponse {
    const { apiCredentials, ...safeSupplier } = supplier;
    return {
      ...safeSupplier,
      hasCredentials: Boolean(apiCredentials && Object.keys(apiCredentials).length > 0),
    };
  }
}
