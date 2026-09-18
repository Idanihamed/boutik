import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Voir le commentaire équivalent sur CreateArticleDto.image (phase 4) : seul un chemin
  // "/uploads/..." renvoyé par l'upload est accepté, pour éviter qu'une URL externe
  // arbitraire fasse planter le rendu `next/image` du catalogue public (déni de service).
  // Même correctif appliqué ici lors de l'analyse d'ensemble, la même classe de bug
  // s'appliquant à toute image affichée via `next/image` sur le site public.
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
