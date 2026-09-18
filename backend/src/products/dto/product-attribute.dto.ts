import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class ProductAttributeDto {
  @IsString()
  @MinLength(1)
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
