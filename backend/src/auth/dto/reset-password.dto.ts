import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Jeton manquant.' })
  token: string;

  // Même règle que ChangePasswordDto.newPassword (§26 du cahier des charges).
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères (§26 du cahier des charges).' })
  newPassword: string;
}
