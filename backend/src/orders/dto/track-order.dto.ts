import { IsString, MaxLength, MinLength } from 'class-validator';

/** Query params de GET /orders/suivi/:reference (voir OrdersService.findByReference). */
export class TrackOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  contact: string;
}
