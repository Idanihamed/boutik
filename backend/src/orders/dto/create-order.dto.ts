import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  /** Téléphone ou email — même principe qu'un message de contact (§23). */
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  customerContact: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  boutiqueId?: string;

  /** Code promo saisi par le client (facultatif). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Plafonné à 50 lignes : une commande "normale" en compte quelques-unes, une valeur plus
  // haute n'a aucune raison légitime et alourdirait inutilement le calcul de prix/stock.
  @ArrayMinSize(1, { message: 'La commande doit contenir au moins un article.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  /** Champ honeypot anti-spam : doit rester vide, voir OrdersService.create. */
  @IsOptional()
  @IsString()
  website?: string;
}
