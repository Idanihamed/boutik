import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class CreatePageDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  // Voir le commentaire équivalent dans CreateArticleDto : seul un chemin "/uploads/..."
  // renvoyé par l'upload d'image est accepté, pour éviter qu'une URL externe arbitraire
  // fasse planter le rendu `next/image` de la page publique (déni de service).
  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  image?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}
