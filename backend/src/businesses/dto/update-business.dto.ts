import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

/** Identité de l'entreprise, modifiable par son Responsable (le slug d'URL, lui, ne change pas). */
export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsUploadedImageUrl()
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Le pays doit être un code ISO à 2 lettres majuscules (ex. CI).' })
  country?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'La devise doit être un code ISO à 3 lettres majuscules (ex. XOF).' })
  currency?: string;
}
