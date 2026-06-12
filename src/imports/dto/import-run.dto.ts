import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export const IMPORT_TRIGGER_TYPES = ['manual', 'scheduled'] as const;
export type ImportTriggerType = (typeof IMPORT_TRIGGER_TYPES)[number];

export class RunImportDto {
  @IsOptional()
  @IsIn(IMPORT_TRIGGER_TYPES)
  triggerType?: ImportTriggerType;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  sourceFingerprint?: string;
}
