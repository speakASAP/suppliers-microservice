import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryMapping } from './category-mapping.entity';

@Injectable()
export class MappingsService {
  constructor(
    @InjectRepository(CategoryMapping)
    private readonly mappingRepository: Repository<CategoryMapping>,
  ) {}

  async findBySupplier(supplierId: string): Promise<CategoryMapping[]> {
    return this.mappingRepository.find({ where: { supplierId } });
  }

  async setMapping(supplierId: string, supplierCategoryId: string, catalogCategoryId: string): Promise<CategoryMapping> {
    let mapping = await this.mappingRepository.findOne({
      where: { supplierId, supplierCategoryId },
    });

    if (mapping) {
      mapping.catalogCategoryId = catalogCategoryId;
    } else {
      mapping = this.mappingRepository.create({
        supplierId,
        supplierCategoryId,
        catalogCategoryId,
      });
    }

    return this.mappingRepository.save(mapping);
  }
}

