import { IsOptional, IsString, IsUrl, Matches, MaxLength, ValidateIf } from 'class-validator';
import { IsUploadedImageUrl } from '../../common/validators/uploaded-image-url.validator';

// Chaque champ accepte une chaîne vide, qui signifie « retirer cette valeur » (voir
// SettingsService.update). Les liens sont limités à http(s) : ils sont affichés tels quels sur la
// vitrine publique, une adresse « javascript: » ne doit jamais pouvoir y être enregistrée.
const notEmpty = (_: unknown, value: unknown) => value !== '';
const LINK = { protocols: ['http', 'https'], require_protocol: true };

export class UpdateSettingsDto {
  // Numéro international (chiffres, espaces, +, tirets, parenthèses) : utilisé pour le lien wa.me.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+()\d\s.-]*$/, { message: 'Numéro WhatsApp invalide.' })
  whatsappNumber?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUrl(LINK, { message: 'Lien invalide (doit commencer par http:// ou https://).' })
  @MaxLength(300)
  facebookUrl?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUrl(LINK, { message: 'Lien invalide (doit commencer par http:// ou https://).' })
  @MaxLength(300)
  instagramUrl?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUrl(LINK, { message: 'Lien invalide (doit commencer par http:// ou https://).' })
  @MaxLength(300)
  tiktokUrl?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUrl(LINK, { message: 'Lien invalide (doit commencer par http:// ou https://).' })
  @MaxLength(300)
  youtubeUrl?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUrl(LINK, { message: 'Lien invalide (doit commencer par http:// ou https://).' })
  @MaxLength(300)
  linkedinUrl?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUrl(LINK, { message: 'Lien invalide (doit commencer par http:// ou https://).' })
  @MaxLength(300)
  xUrl?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUploadedImageUrl()
  heroImage1?: string;

  @IsOptional()
  @ValidateIf(notEmpty)
  @IsUploadedImageUrl()
  heroImage2?: string;
}
