import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Supplier } from './supplier.entity';

export type SupplierActor = {
  sub: string;
  email?: string;
  roles: string[];
};

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async findAll(actor?: SupplierActor): Promise<Supplier[]> {
    const where = this.isAdmin(actor)
      ? { isActive: true }
      : { isActive: true, ownerUserId: actor?.sub || '__missing_owner__' };
    return this.supplierRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, actor?: SupplierActor): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    this.assertCanAccess(supplier, actor);
    return supplier;
  }

  async create(data: CreateSupplierDto, actor?: SupplierActor): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      ...data,
      ownerUserId: actor?.sub || null,
      ownerEmail: actor?.email || null,
    });
    return this.supplierRepository.save(supplier);
  }

  async update(id: string, data: UpdateSupplierDto, actor?: SupplierActor): Promise<Supplier> {
    const supplier = await this.findOne(id, actor);
    Object.assign(supplier, data);
    return this.supplierRepository.save(supplier);
  }

  async assertSupplierVisible(id: string, actor?: SupplierActor): Promise<Supplier> {
    return this.findOne(id, actor);
  }

  async updateSyncStatus(id: string, status: string): Promise<void> {
    await this.supplierRepository.update(id, {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
    });
  }

  private assertCanAccess(supplier: Supplier, actor?: SupplierActor): void {
    if (this.isAdmin(actor)) return;
    if (!actor?.sub || supplier.ownerUserId !== actor.sub) {
      throw new ForbiddenException('Supplier belongs to another account');
    }
  }

  private isAdmin(actor?: SupplierActor): boolean {
    const roles = actor?.roles || [];
    const serviceName = process.env.SERVICE_NAME || 'suppliers-microservice';
    return roles.some((role) => [
      'global:superadmin',
      'global:platform_admin',
      `internal:${serviceName}:admin`,
    ].includes(role));
  }
}
