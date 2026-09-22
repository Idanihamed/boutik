import { IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
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

  // Paiement par transfert Mobile Money direct (pas de prestataire branché) : le client
  // transfère lui-même à ce numéro avant de valider sa commande (voir CreateOrderDto.paymentReference).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mobileMoneyProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+()\d\s.-]*$/, { message: 'Numéro Mobile Money invalide.' })
  mobileMoneyNumber?: string;

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

  // Livraison à domicile (0 = gratuite). Montants entiers dans la devise de l'entreprise.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  shippingFee?: number;

  // Seuil de commande à partir duquel la livraison est offerte ; null = jamais offerte.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  freeShippingThreshold?: number | null;
}
