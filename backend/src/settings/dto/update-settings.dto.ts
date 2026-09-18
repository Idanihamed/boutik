import { IsOptional, IsString } from 'class-validator';

// Chaîne vide acceptée pour permettre de retirer un lien déjà renseigné (voir
// SettingsService.update : une chaîne vide est convertie en `null` avant écriture).
// Pas de @IsUrl : cohérent avec googleMapsUrl (BoutiqueDto), qui accepte aussi une chaîne
// libre plutôt que de rejeter une URL "presque valide" saisie par un non-technicien.
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  tiktokUrl?: string;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  xUrl?: string;

  @IsOptional()
  @IsString()
  heroImage1?: string;

  @IsOptional()
  @IsString()
  heroImage2?: string;
}
