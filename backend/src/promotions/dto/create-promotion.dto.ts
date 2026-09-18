import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE'])
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';

  @IsInt()
  @Min(0)
  value: number;

  /** Date + heure de début, au format ISO 8601 (le frontend combine date et heure avant l'envoi). */
  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'DISABLED'])
  adminStatus?: 'DRAFT' | 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsString()
  bannerTitle?: string;

  @IsOptional()
  @IsString()
  bannerSubtitle?: string;

  @IsOptional()
  @IsString()
  bannerImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => String)
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => String)
  @IsString({ each: true })
  categoryIds?: string[];
}
