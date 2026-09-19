import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Inscription libre d'une entreprise : crée l'entreprise (en attente de validation) et son Responsable. */
export class RegisterBusinessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  // Identifiant dans l'URL de la vitrine (ex. "ma-boutique" pour boutik.com/ma-boutique). Généré à partir du
  // nom si absent.
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/, {
    message: 'Identifiant invalide : lettres minuscules, chiffres et tirets uniquement (2 à 63 caractères).',
  })
  slug?: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Le pays doit être un code ISO à 2 lettres majuscules (ex. CI).' })
  country: string;

  // Déduite du pays quand celui-ci est connu ; obligatoire sinon.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'La devise doit être un code ISO à 3 lettres majuscules (ex. XOF).' })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
