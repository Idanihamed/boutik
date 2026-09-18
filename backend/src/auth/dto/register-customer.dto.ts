import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  // Même règle que CreateUserDto.password.
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  password: string;
}
