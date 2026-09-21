import { IsString, MaxLength } from 'class-validator';

export class PushTokenDto {
  @IsString()
  @MaxLength(200)
  token: string;
}
