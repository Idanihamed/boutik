import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

/** Aperçu d'un panier : les articles, le mode de retrait et un éventuel code promo. */
export class QuoteOrderDto {
  @ArrayMinSize(1, { message: 'Le panier est vide.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  /** Retrait en boutique : pas de frais de livraison. */
  @IsOptional()
  @IsString()
  boutiqueId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;
}
