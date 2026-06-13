import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CategoryMapping } from './category-mapping.entity';
import { SetCategoryMappingDto } from './dto/set-category-mapping.dto';

export interface CategoryMappingValidationResult {
  supplierId: string;
  requestedCategoryCount: number;
  mappedCategoryCount: number;
  missingSupplierCategoryIds: string[];
  complete: boolean;
}

@Injectable()
export class MappingsService {
  constructor(
    @InjectRepository(CategoryMapping)
    private readonly mappingRepository: Repository<CategoryMapping>,
  ) {}

  async findBySupplier(supplierId: string): Promise<CategoryMapping[]> {
    return this.mappingRepository.find({
      where: { supplierId },
      order: { supplierCategoryId: 'ASC' },
    });
  }

  async setMapping(data: SetCategoryMappingDto): Promise<CategoryMapping> {
    const supplierId = data.supplierId;
    const supplierCategoryId = data.supplierCategoryId.trim();
    const catalogCategoryId = data.catalogCategoryId;
    const supplierCategoryName = data.supplierCategoryName?.trim();

    let mapping = await this.mappingRepository.findOne({
      where: { supplierId, supplierCategoryId },
    });

    if (mapping) {
      mapping.catalogCategoryId = catalogCategoryId;
      if (supplierCategoryName) mapping.supplierCategoryName = supplierCategoryName;
    } else {
      mapping = this.mappingRepository.create({
        supplierId,
        supplierCategoryId,
        supplierCategoryName,
        catalogCategoryId,
      });
    }

    return this.mappingRepository.save(mapping);
  }

  async validateSupplierCategories(
    supplierId: string,
    supplierCategoryIds: string[],
  ): Promise<CategoryMappingValidationResult> {
    const normalizedIds = [...new Set(supplierCategoryIds.map((item) => item.trim()))];
    const mappings = await this.mappingRepository.find({
      where: {
        supplierId,
        supplierCategoryId: In(normalizedIds),
      },
    });

    const mappedIds = new Set(
      mappings
        .filter((mapping) => Boolean(mapping.catalogCategoryId))
        .map((mapping) => mapping.supplierCategoryId),
    );
    const missingSupplierCategoryIds = normalizedIds.filter((supplierCategoryId) => !mappedIds.has(supplierCategoryId));

    return {
      supplierId,
      requestedCategoryCount: normalizedIds.length,
      mappedCategoryCount: mappedIds.size,
      missingSupplierCategoryIds,
      complete: missingSupplierCategoryIds.length === 0,
    };
  }
}
