import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// class-transformer's @Type(() => Boolean) is naive (Boolean("false") === true),
// donc on convertit explicitement les booléens reçus en query string.
const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value;
};

export class QueryProductsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string; // slug

  @IsOptional()
  @IsString()
  brand?: string; // slug

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  onSale?: boolean;

  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'newest', 'name_asc'])
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
}

export class QueryProductsAdminDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}
