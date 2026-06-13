import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, Length, Matches } from 'class-validator';

export class ValidateCategoryMappingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  @Matches(/^[A-Za-z0-9._:/ -]+$/, { each: true })
  supplierCategoryIds: string[];
}
