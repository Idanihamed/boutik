import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est requis.' })
  currentPassword: string;

  // Même règle que CreateUserDto.password (§26 du cahier des charges).
  @IsString()
  @MinLength(10, { message: 'Le nouveau mot de passe doit contenir au moins 10 caractères (§26 du cahier des charges).' })
  newPassword: string;
}
