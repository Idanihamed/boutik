import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class BoutiqueImageDto {
  // Voir uploaded-image-url.validator.ts : seule une URL renvoyée par l'upload (locale ou
  // Cloudinary) est acceptée, pour éviter qu'une URL externe arbitraire fasse planter le
  // rendu `next/image` de la page boutique (déni de service).
  @IsString()
  @IsUploadedImageUrl()
  url: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
