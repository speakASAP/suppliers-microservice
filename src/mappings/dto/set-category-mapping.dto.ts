import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class SetCategoryMappingDto {
  @IsUUID()
  supplierId: string;

  @IsString()
  @Length(1, 200)
  @Matches(/^[A-Za-z0-9._:/ -]+$/)
  supplierCategoryId: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  supplierCategoryName?: string;

  @IsUUID()
  catalogCategoryId: string;
}
