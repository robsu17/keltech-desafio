import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum DocumentStatusFilter {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  ERROR = 'ERROR',
}

export class ListDocumentsDto {
  @IsOptional()
  @IsEnum(DocumentStatusFilter, {
    message: 'Status inválido. Use: PENDING, PROCESSED ou ERROR',
  })
  status?: DocumentStatusFilter;

  @IsOptional()
  @IsDateString({}, { message: 'from deve ser uma data ISO 8601 (ex: 2024-01-01)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to deve ser uma data ISO 8601 (ex: 2024-12-31)' })
  to?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'hasMetadata deve ser true ou false' })
  hasMetadata?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
