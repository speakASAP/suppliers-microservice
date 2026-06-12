import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export const SUPPLIER_API_TYPES = ['rest', 'xml', 'csv', 'ftp'] as const;
export type SupplierApiType = (typeof SUPPLIER_API_TYPES)[number];

export class SupplierCredentialRefsDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  apiKeyRef?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  usernameRef?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  passwordRef?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  tokenRef?: string;
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/i)
  code: string;

  @IsIn(SUPPLIER_API_TYPES)
  apiType: SupplierApiType;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https', 'ftp'] })
  @Length(1, 500)
  apiUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SupplierCredentialRefsDto)
  apiCredentials?: SupplierCredentialRefsDto;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^(@(hourly|daily|weekly|monthly|yearly|annually|reboot)|(@every\s+\d+[smhdw])|((\S+\s+){4}\S+))$/)
  syncSchedule?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/i)
  code?: string;

  @IsOptional()
  @IsIn(SUPPLIER_API_TYPES)
  apiType?: SupplierApiType;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https', 'ftp'] })
  @Length(1, 500)
  apiUrl?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SupplierCredentialRefsDto)
  apiCredentials?: SupplierCredentialRefsDto;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^(@(hourly|daily|weekly|monthly|yearly|annually|reboot)|(@every\s+\d+[smhdw])|((\S+\s+){4}\S+))$/)
  syncSchedule?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
