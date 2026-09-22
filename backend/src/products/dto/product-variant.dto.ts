import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class ProductVariantDto {
  @IsOptional()
  @IsString()
  option1Value?: string;

  @IsOptional()
  @IsString()
  option2Value?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  /** null ou absent = utilise le prix du produit (voir resolveVariantBasePrice). */
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  promoPrice?: number | null;

  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
