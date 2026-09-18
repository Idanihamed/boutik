import { IsString, MaxLength, MinLength } from 'class-validator';

/** Query params de GET /contact/suivi/:reference (voir ContactMessagesService.findByReference). */
export class TrackContactMessageDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  contact: string;
}
