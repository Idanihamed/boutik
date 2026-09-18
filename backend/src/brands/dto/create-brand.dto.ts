import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class CreateBrandDto {
  @IsString()
  @MinLength(1)
  name: string;

  // Non affiché nulle part dans le front-end pour l'instant (champ "mort", comme
  // `Promotion.bannerImage` avant son raccordement en phase 2) — mais même contrainte que
  // les autres champs image du projet par cohérence et pour anticiper son affichage futur
  // via `next/image` (voir le commentaire équivalent sur CreateArticleDto.image, phase 4).
  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  logo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
