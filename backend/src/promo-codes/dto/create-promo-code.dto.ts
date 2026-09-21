import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

export class CreatePromoCodeDto {
  /** 3 à 20 caractères : lettres, chiffres, tiret ou tiret bas. Enregistré en majuscules. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,20}$/, { message: 'Le code doit faire 3 à 20 caractères (lettres, chiffres, - ou _).' })
  code: string;

  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT'])
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';

  /** Pourcentage (1 à 100) ou montant à retirer dans la devise de l'entreprise. */
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  value: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  minOrderAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
