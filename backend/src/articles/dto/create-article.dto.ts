import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(2)
  title: string;

  // §20 : ce champ n'est censé contenir que l'URL renvoyée par l'upload d'image
  // (`MediaService.saveFile`, chemin local "/uploads/..." ou URL Cloudinary selon
  // STORAGE_DRIVER — voir uploaded-image-url.validator.ts), jamais une URL absolue arbitraire.
  // Sans cette contrainte, un compte disposant seulement de `articles:create`/`update` (donc
  // pas forcément Super Admin) pouvait enregistrer n'importe quelle URL ici ; le site public
  // l'affiche ensuite via `next/image`, qui refuse au rendu tout hôte non listé dans
  // `images.remotePatterns` (next.config.mjs) et lève une exception — ce qui casse la page
  // publique de l'actualité concernée, et même TOUTE la liste `/actualites` puisque les
  // vignettes y sont rendues dans la même page serveur. Un simple déni de service
  // auto-infligeable ou malveillant, désormais bloqué en amont.
  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  image?: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;
}
