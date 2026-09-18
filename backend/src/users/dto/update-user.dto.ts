import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  roleName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Réinitialisation par le Super Admin (voir UsersController — cette route entière requiert
  // déjà users:update, réservé au Super Admin) : un Gestionnaire/Éditeur qui a oublié son mot
  // de passe n'a auparavant aucun moyen de le récupérer, faute de champ dédié dans ce DTO.
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères (§26 du cahier des charges).' })
  password?: string;
}
