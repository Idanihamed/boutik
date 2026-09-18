import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères (§26 du cahier des charges).' })
  password: string;

  @IsString()
  roleName: string; // ex. "GESTIONNAIRE", "EDITEUR"
}
